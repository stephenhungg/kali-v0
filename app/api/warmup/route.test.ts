/**
 * Integration tests for POST/GET /api/warmup.
 *
 * Uses the FakeEmbedder so the index build is deterministic + offline.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { FakeEmbedder, getEmbedder, __resetEmbedder } from "@/lib/context/embed";
import { __resetVectorStore } from "@/lib/context/vectorStore";
import { __resetIndexedCache } from "@/lib/context/semanticSearch";
import { POST, GET } from "./route";

beforeAll(() => {
  getEmbedder(new FakeEmbedder());
});
afterAll(() => {
  __resetVectorStore();
  __resetIndexedCache();
  __resetEmbedder();
});

describe("/api/warmup", () => {
  test("POST returns connector init + index timings + chunk counts", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      durationMs: number;
      connectorInitMs: number;
      indexMs: number;
      embedder: string;
      embedderDim: number;
      totalChunks: number;
      chunksBySource: Record<string, number>;
      connectors: Array<{
        connectorId: string;
        status: string;
      }>;
    };
    expect(body.durationMs).toBeGreaterThan(0);
    expect(body.connectorInitMs).toBeGreaterThanOrEqual(0);
    expect(body.indexMs).toBeGreaterThan(0);
    expect(body.embedder).toBe("fake-fnv-256");
    expect(body.embedderDim).toBe(256);
    expect(body.totalChunks).toBeGreaterThan(0);
    expect(Object.keys(body.chunksBySource).length).toBeGreaterThan(0);
    expect(body.connectors.length).toBeGreaterThan(0);
    for (const c of body.connectors) expect(c.status).toBe("connected");
  });

  test("subsequent POST calls return the cached result (no rebuild)", async () => {
    const a = await POST();
    const aBody = await a.json();
    const b = await POST();
    const bBody = await b.json();
    // Same totals — the warm cache hands back the same payload.
    expect((bBody as { totalChunks: number }).totalChunks).toBe(
      (aBody as { totalChunks: number }).totalChunks,
    );
  });

  test("GET works as a synonym", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalChunks: number };
    expect(body.totalChunks).toBeGreaterThan(0);
  });
});
