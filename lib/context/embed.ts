/**
 * Embedder — OpenAI (default) with Voyage AI as a cost-optimized
 * alternative and a deterministic hash-based fallback for dev / tests /
 * no-key environments.
 *
 * Provider selection (first match wins):
 *   1. KALI_EMBEDDER override env: "openai" | "voyage" | "fake"
 *   2. OPENAI_API_KEY → OpenAIEmbedder (text-embedding-3-small, 1536-dim
 *      — cheaper sibling of -3-large and competitive on MTEB)
 *   3. VOYAGE_API_KEY → VoyageEmbedder (voyage-3, 1024-dim, ~7× cheaper
 *      at high volume than text-embedding-3-large)
 *   4. Otherwise FakeEmbedder (256-dim deterministic hash sketch — not
 *      great quality, but offline + reproducible for tests).
 *
 * Vectors are L2-normalized so cosine similarity reduces to a dot product.
 */

const FAKE_DIM = 256;

export interface Embedder {
  /** Display label — emitted in the vectorStore for debugging. */
  readonly model: string;
  /** Output vector dimension (vectors must all match within one store). */
  readonly dim: number;
  /** Embed a single text. */
  embed(text: string): Promise<Float32Array>;
  /** Batch — provider-native when available, fan-out otherwise. */
  embedMany(texts: string[]): Promise<Float32Array[]>;
}

/* ─── L2 normalize / cosine helpers ─────────────────────────────────── */

export function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

export function cosineSim(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`vector dim mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/* ─── deterministic fallback ────────────────────────────────────────── */

/** FNV-1a 32-bit hash. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "this", "that",
  "these", "those", "it", "its", "as", "at", "by", "from", "but", "if",
  "then", "else", "we", "you", "they", "them", "our", "their", "i",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Project a tokenized text into a 256-dim sketch by scattering each token's
 * contribution across two dimensions (signed, per the FNV-1a hash). This is
 * the same idea as feature hashing in scikit-learn's HashingVectorizer.
 */
export class FakeEmbedder implements Embedder {
  readonly model = "fake-fnv-256";
  readonly dim = FAKE_DIM;

  async embed(text: string): Promise<Float32Array> {
    const v = new Float32Array(FAKE_DIM);
    const toks = tokenize(text);
    for (const t of toks) {
      const h = fnv1a(t);
      const idx1 = h % FAKE_DIM;
      const idx2 = (h >>> 16) % FAKE_DIM;
      const sign = (h & 1) === 0 ? 1 : -1;
      v[idx1] += sign;
      v[idx2] += sign * 0.5;
    }
    return l2Normalize(v);
  }

  async embedMany(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

/* ─── Voyage AI client ──────────────────────────────────────────────── */

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage?: { total_tokens: number };
}

export class VoyageEmbedder implements Embedder {
  readonly model: string;
  readonly dim = 1024; // voyage-3 default
  private readonly apiKey: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "voyage-3";
  }

  async embed(text: string): Promise<Float32Array> {
    const r = await this.embedMany([text]);
    return r[0];
  }

  async embedMany(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        input_type: "document",
      }),
    });
    if (!res.ok) {
      throw new Error(`voyage ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as VoyageResponse;
    // Sort by `index` because Voyage may not return them in input order.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => l2Normalize(new Float32Array(d.embedding)));
  }
}

/* ─── OpenAI fallback ───────────────────────────────────────────────── */

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
}

export class OpenAIEmbedder implements Embedder {
  readonly model: string;
  /** -3-small is 1536; -3-large is 3072. Set on construction. */
  readonly dim: number;
  private readonly apiKey: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "text-embedding-3-small";
    this.dim = this.model === "text-embedding-3-large" ? 3072 : 1536;
  }

  async embed(text: string): Promise<Float32Array> {
    const r = await this.embedMany([text]);
    return r[0];
  }

  async embedMany(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) {
      throw new Error(`openai ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as OpenAIEmbeddingResponse;
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => l2Normalize(new Float32Array(d.embedding)));
  }
}

/* ─── factory ───────────────────────────────────────────────────────── */

let __cached: Embedder | null = null;

/**
 * Get the embedder for this process. Choice order:
 *   1. Explicit override (testing).
 *   2. KALI_EMBEDDER env var ("openai" | "voyage" | "fake") — explicit pin.
 *   3. OPENAI_API_KEY → OpenAIEmbedder (default — simpler integration).
 *   4. VOYAGE_API_KEY → VoyageEmbedder (cheaper at scale).
 *   5. FakeEmbedder (deterministic, offline).
 */
export function getEmbedder(override?: Embedder): Embedder {
  if (override) {
    __cached = override;
    return override;
  }
  if (__cached) return __cached;
  const pin = process.env.KALI_EMBEDDER;
  if (pin === "fake") {
    __cached = new FakeEmbedder();
    return __cached;
  }
  if (pin === "voyage" && process.env.VOYAGE_API_KEY) {
    __cached = new VoyageEmbedder({ apiKey: process.env.VOYAGE_API_KEY });
    return __cached;
  }
  if (pin === "openai" && process.env.OPENAI_API_KEY) {
    __cached = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
    return __cached;
  }
  if (process.env.OPENAI_API_KEY) {
    __cached = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
  } else if (process.env.VOYAGE_API_KEY) {
    __cached = new VoyageEmbedder({ apiKey: process.env.VOYAGE_API_KEY });
  } else {
    __cached = new FakeEmbedder();
  }
  return __cached;
}

export function __resetEmbedder(): void {
  __cached = null;
}
