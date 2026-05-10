// Hybrid retrieval over embedded chunks. In-memory; loads on first call.
//
// Two interfaces:
//
//   1) CLI: bun run src/retrieve.ts medium "your query here" [--source bloomerang] [--k 10]
//
//   2) Programmatic:
//      import { loadStore, query } from "./retrieve.ts"
//      const store = await loadStore("medium");
//      const results = await query(store, { text: "...", filters: { source: "sharepoint" }, k: 10 });

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Chunk } from "./chunker.ts";

interface EmbeddedChunk extends Chunk {
  vector: number[];
}

export interface Store {
  size: "small" | "medium" | "large";
  chunks: EmbeddedChunk[];
  apiKey: string;
}

export interface QueryFilters {
  source?: Chunk["source"] | Chunk["source"][];
  type?: string | string[];
  // Free-form metadata predicates (exact match)
  metadata?: Record<string, string | number | boolean>;
  // Range filters
  minAmount?: number;
  maxAmount?: number;
}

export interface QueryOptions {
  text: string;
  filters?: QueryFilters;
  k?: number;
}

export interface RetrievalHit extends EmbeddedChunk {
  score: number;
}

const MODEL = "text-embedding-3-small";

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

function cosine(a: number[], b: number[]): number {
  return dot(a, b) / (norm(a) * norm(b) + 1e-12);
}

export async function loadStore(size: "small" | "medium" | "large"): Promise<Store> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const root = new URL("../", import.meta.url).pathname;
  const path = join(root, "data", size, "chunks.embedded.jsonl");
  const raw = await readFile(path, "utf8");
  const chunks = raw.split("\n").filter(Boolean).map(l => JSON.parse(l) as EmbeddedChunk);
  return { size, chunks, apiKey };
}

async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: text, encoding_format: "float" }),
  });
  if (!res.ok) throw new Error(`query embed failed: ${res.status}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

function passesFilters(c: EmbeddedChunk, f?: QueryFilters): boolean {
  if (!f) return true;
  if (f.source) {
    const sources = Array.isArray(f.source) ? f.source : [f.source];
    if (!sources.includes(c.source)) return false;
  }
  if (f.type) {
    const types = Array.isArray(f.type) ? f.type : [f.type];
    if (!types.includes(c.type)) return false;
  }
  if (f.metadata) {
    for (const [k, v] of Object.entries(f.metadata)) {
      if (c.metadata[k] !== v) return false;
    }
  }
  if (f.minAmount !== undefined && typeof c.metadata.amount === "number" && c.metadata.amount < f.minAmount) return false;
  if (f.maxAmount !== undefined && typeof c.metadata.amount === "number" && c.metadata.amount > f.maxAmount) return false;
  return true;
}

export async function query(store: Store, opts: QueryOptions): Promise<RetrievalHit[]> {
  const k = opts.k ?? 10;
  const qVec = await embedQuery(store.apiKey, opts.text);
  const candidates = store.chunks.filter(c => passesFilters(c, opts.filters));
  const scored = candidates.map(c => ({ ...c, score: cosine(qVec, c.vector) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ── CLI ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const size = (args[0] ?? "medium") as "small" | "medium" | "large";
  const queryText = args[1];
  if (!queryText) {
    console.error('usage: bun run src/retrieve.ts <size> "<query>" [--source <s>] [--type <t>] [--k <n>]');
    process.exit(1);
  }
  let source: string | undefined;
  let type: string | undefined;
  let k = 10;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--source") source = args[++i];
    else if (args[i] === "--type") type = args[++i];
    else if (args[i] === "--k") k = parseInt(args[++i], 10);
  }

  console.log(`[retrieve] loading store (size=${size})...`);
  const store = await loadStore(size);
  console.log(`[retrieve] ${store.chunks.length.toLocaleString()} chunks loaded.`);
  console.log(`[retrieve] querying: "${queryText}"`);
  if (source) console.log(`[retrieve] source filter: ${source}`);
  if (type) console.log(`[retrieve] type filter: ${type}`);

  const t0 = Date.now();
  const hits = await query(store, { text: queryText, filters: { source: source as Chunk["source"], type }, k });
  console.log(`[retrieve] top ${hits.length} in ${Date.now() - t0}ms:\n`);
  hits.forEach((h, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. [${h.score.toFixed(3)}] [${h.source}/${h.type}] ${h.kali_entity_id}`);
    console.log(`    ${h.text.replace(/\n/g, " ").slice(0, 200)}${h.text.length > 200 ? "..." : ""}`);
    console.log();
  });
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });
