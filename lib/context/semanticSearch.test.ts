/**
 * End-to-end tests for the indexer + semanticSearch + the registry tools.
 * Uses the FakeEmbedder by default (no API keys, deterministic).
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { FakeEmbedder, getEmbedder, __resetEmbedder } from "./embed";
import { chunkText, indexAll } from "./indexer";
import {
  semanticSearch,
  __resetIndexedCache,
  type SemanticSearchResult,
} from "./semanticSearch";
import { context } from "./entity";
import { __resetVectorStore } from "./vectorStore";
import { makeCapturingContext } from "../connectors/test-helpers";

beforeAll(() => {
  // Force the deterministic embedder for the whole file.
  getEmbedder(new FakeEmbedder());
});

afterEach(() => {
  // Don't blow away the index between tests — most tests benefit from the
  // single warmed index. The "rebuild" tests handle their own resets.
});

describe("chunkText", () => {
  test("returns a single chunk for short inputs", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  test("splits long text with overlap", () => {
    const text = Array.from({ length: 1500 }, (_, i) => `t${i}`).join(" ");
    const chunks = chunkText(text, { maxTokens: 500, overlapTokens: 100 });
    expect(chunks.length).toBeGreaterThan(2);
    // Each chunk should have ≤ 500 tokens
    for (const c of chunks) {
      expect(c.split(/\s+/).length).toBeLessThanOrEqual(500);
    }
  });

  test("empty input returns empty list", () => {
    expect(chunkText("")).toEqual([]);
  });
});

describe("indexAll + semanticSearch", () => {
  test("indexAll() returns counts across multiple sources", async () => {
    __resetVectorStore();
    __resetIndexedCache();
    const r = await indexAll({ namespace: "rivertown" });
    expect(r.namespace).toBe("rivertown");
    expect(r.embedder).toBe("fake-fnv-256");
    expect(r.embedderDim).toBe(256);
    expect(r.total).toBeGreaterThan(0);
    expect(Object.keys(r.chunksBySource)).toContain("m365");
    expect(Object.keys(r.chunksBySource)).toContain("instrumentl");
  });

  test("semanticSearch returns relevant hits", async () => {
    const r = await semanticSearch({
      query: "donor",
      limit: 10,
    });
    expect(r.count).toBeGreaterThan(0);
    expect(r.hits[0].score).toBeGreaterThanOrEqual(r.hits[r.hits.length - 1].score);
  });

  test("source filter narrows results", async () => {
    const r = await semanticSearch({
      query: "donor",
      sources: ["bloomerang"],
      limit: 20,
    });
    for (const h of r.hits) expect(h.source).toBe("bloomerang");
  });

  test("metaEq filter respects meta keys", async () => {
    const r = await semanticSearch({
      query: "youth program",
      sources: ["sharepoint"],
      metaEq: { docType: "board_minutes" },
      limit: 20,
    });
    for (const h of r.hits) {
      expect((h.meta ?? {}).docType).toBe("board_minutes");
    }
  });

  test("limit caps the hit list", async () => {
    const r = await semanticSearch({ query: "the", limit: 3 });
    expect(r.hits.length).toBeLessThanOrEqual(3);
  });

  test("minScore filters out low-similarity hits", async () => {
    const r = await semanticSearch({
      query: "xyzzy_definitely_no_match_anywhere",
      minScore: 0.5,
      limit: 50,
    });
    // The fake embedder might surface noise; minScore should cap it.
    for (const h of r.hits) expect(h.score).toBeGreaterThanOrEqual(0.5);
  });

  test("hits include sourceRecordId + text + meta", async () => {
    const r = await semanticSearch({ query: "annual gala", limit: 5 });
    for (const h of r.hits) {
      expect(h.sourceRecordId.length).toBeGreaterThan(0);
      expect(h.text.length).toBeGreaterThan(0);
    }
  });

  test("forceReindex actually rebuilds", async () => {
    const before = await semanticSearch({ query: "donor", limit: 1 });
    const after = await semanticSearch({
      query: "donor",
      limit: 1,
      forceReindex: true,
    });
    expect(after.totalCandidates).toBe(before.totalCandidates);
  });
});

describe("context.semanticSearch tool", () => {
  test("registered + tool surface", () => {
    expect(context.tools.some((t) => t.name === "context.semanticSearch")).toBe(
      true,
    );
    expect(context.tools.some((t) => t.name === "context.rebuildIndex")).toBe(
      true,
    );
  });

  test("tool handler runs through audit ctx", async () => {
    const tool = context.tools.find((t) => t.name === "context.semanticSearch")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { query: "donor segmentation", limit: 3 },
      ctx,
    )) as SemanticSearchResult;
    expect(out.hits.length).toBeGreaterThan(0);
    expect(ctx.entries).toHaveLength(1);
    expect(ctx.entries[0].source).toBe("context");
    expect(ctx.entries[0].toolName).toBe("context.semanticSearch");
  });

  test("rebuildIndex tool returns chunk counts", async () => {
    const tool = context.tools.find((t) => t.name === "context.rebuildIndex")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({}, ctx)) as {
      total: number;
      chunksBySource: Record<string, number>;
    };
    expect(out.total).toBeGreaterThan(0);
    expect(Object.keys(out.chunksBySource).length).toBeGreaterThan(0);
  });
});

describe("getEmbedder fallback", () => {
  test("returns FakeEmbedder when no API keys configured", () => {
    __resetEmbedder();
    const prevVoyage = process.env.VOYAGE_API_KEY;
    const prevOpenai = process.env.OPENAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const e = getEmbedder();
      expect(e.model).toBe("fake-fnv-256");
    } finally {
      if (prevVoyage !== undefined) process.env.VOYAGE_API_KEY = prevVoyage;
      if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
      __resetEmbedder();
      // Restore the file-level fake for any subsequent test
      getEmbedder(new FakeEmbedder());
    }
  });
});
