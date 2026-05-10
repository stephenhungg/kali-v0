// Embeds chunks.jsonl using OpenAI text-embedding-3-small.
// Writes chunks.embedded.jsonl with a `vector` field on every line.
//
// Usage:
//   OPENAI_API_KEY=... bun run src/embed.ts medium
//
// Cheap: medium dataset (~308K tokens) costs ~$0.006 with 3-small.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Chunk } from "./chunker.ts";

const MODEL = "text-embedding-3-small";
const DIMS = 1536;
const BATCH_SIZE = 100; // openai allows up to 2048, 100 keeps things sane on retries

interface EmbeddedChunk extends Chunk {
  vector: number[];
}

async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  while (true) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: texts, encoding_format: "float" }),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait = parseInt(res.headers.get("retry-after") ?? "5", 10) * 1000;
      console.warn(`[embed] ${res.status}, retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`embed failed ${res.status}: ${txt.slice(0, 400)}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map(d => d.embedding);
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set. export it from your shell or pass inline.");
    process.exit(1);
  }
  const sizeArg = (process.argv[2] ?? "medium") as "small" | "medium" | "large";

  const root = new URL("../", import.meta.url).pathname;
  const inPath = join(root, "data", sizeArg, "chunks.jsonl");
  const outPath = join(root, "data", sizeArg, "chunks.embedded.jsonl");

  console.log(`[embed] reading ${inPath}...`);
  const lines = (await readFile(inPath, "utf8")).split("\n").filter(Boolean);
  const chunks: Chunk[] = lines.map(l => JSON.parse(l));
  console.log(`[embed] ${chunks.length.toLocaleString()} chunks to embed.`);
  console.log(`[embed] est tokens: ${Math.round(chunks.reduce((s, c) => s + c.text.length / 4, 0)).toLocaleString()}`);
  console.log(`[embed] using model=${MODEL} dims=${DIMS} batch=${BATCH_SIZE}`);
  console.log(`[embed] starting in 1s...`);
  await new Promise(r => setTimeout(r, 1000));

  const t0 = Date.now();
  const embedded: EmbeddedChunk[] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);
    const vectors = await embedBatch(apiKey, texts);
    for (let j = 0; j < batch.length; j++) {
      embedded.push({ ...batch[j], vector: vectors[j] });
    }
    const pct = Math.round(((i + batch.length) / chunks.length) * 100);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`\r[embed] ${pct}% (${embedded.length}/${chunks.length}) — ${elapsed}s elapsed   `);
  }
  console.log();

  console.log(`[embed] writing ${outPath}...`);
  const out = embedded.map(c => JSON.stringify(c)).join("\n");
  await writeFile(outPath, out);
  console.log(`[embed] done in ${((Date.now() - t0) / 1000).toFixed(1)}s. wrote ${embedded.length.toLocaleString()} embedded chunks (${(out.length / 1024 / 1024).toFixed(1)}MB).`);
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });
