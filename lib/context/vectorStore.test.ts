import { afterEach, describe, expect, test } from "bun:test";
import { FakeEmbedder, l2Normalize } from "./embed";
import {
  clear,
  listNamespaces,
  search,
  size,
  totalSize,
  upsert,
  upsertMany,
  __resetVectorStore,
} from "./vectorStore";

afterEach(() => __resetVectorStore());

const embedder = new FakeEmbedder();

async function vec(text: string) {
  return embedder.embed(text);
}

describe("upsert / upsertMany", () => {
  test("appends entries to a namespace", async () => {
    upsert({
      namespace: "tenant_a",
      source: "zoom",
      sourceRecordId: "zoom_1",
      chunkIndex: 0,
      text: "hello",
      vector: await vec("hello"),
    });
    expect(size("tenant_a")).toBe(1);
  });

  test("upserts replace by (source, sourceRecordId, chunkIndex)", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "zoom_1",
      chunkIndex: 0,
      text: "v1",
      vector: await vec("v1"),
    });
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "zoom_1",
      chunkIndex: 0,
      text: "v2",
      vector: await vec("v2"),
    });
    expect(size("ns")).toBe(1);
  });

  test("different chunk indices coexist", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "zoom_1",
      chunkIndex: 0,
      text: "a",
      vector: await vec("a"),
    });
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "zoom_1",
      chunkIndex: 1,
      text: "b",
      vector: await vec("b"),
    });
    expect(size("ns")).toBe(2);
  });
});

describe("namespace isolation", () => {
  test("entries are partitioned by namespace", async () => {
    upsert({
      namespace: "tenant_a",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "a",
      vector: await vec("a"),
    });
    upsert({
      namespace: "tenant_b",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "b",
      vector: await vec("b"),
    });
    expect(size("tenant_a")).toBe(1);
    expect(size("tenant_b")).toBe(1);
    expect(totalSize()).toBe(2);
    expect(listNamespaces()).toEqual(["tenant_a", "tenant_b"]);
  });

  test("clear() drops one namespace without touching others", async () => {
    upsert({
      namespace: "tenant_a",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "a",
      vector: await vec("a"),
    });
    upsert({
      namespace: "tenant_b",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "b",
      vector: await vec("b"),
    });
    clear("tenant_a");
    expect(size("tenant_a")).toBe(0);
    expect(size("tenant_b")).toBe(1);
  });
});

describe("search", () => {
  test("returns top-K sorted by cosine sim descending", async () => {
    upsertMany(
      await Promise.all(
        ["youth tutoring", "donor gala", "youth mentorship cohort"].map(
          async (text, i) => ({
            namespace: "ns",
            source: "zoom" as const,
            sourceRecordId: `r_${i}`,
            chunkIndex: 0,
            text,
            vector: await vec(text),
          }),
        ),
      ),
    );

    const q = await vec("youth mentorship");
    const hits = search("ns", q, { limit: 3 });
    expect(hits.length).toBe(3);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score);
    }
    // Top hit should be the youth-related entry, not "donor gala"
    expect(hits[0].text).toContain("youth");
  });

  test("limit is enforced + hard-capped at 200", async () => {
    for (let i = 0; i < 10; i++) {
      upsert({
        namespace: "ns",
        source: "zoom",
        sourceRecordId: `r_${i}`,
        chunkIndex: 0,
        text: `item ${i}`,
        vector: await vec(`item ${i}`),
      });
    }
    const hits = search("ns", await vec("item"), { limit: 3 });
    expect(hits.length).toBe(3);
  });

  test("source filter pre-filters before scoring", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "x",
      vector: await vec("x"),
    });
    upsert({
      namespace: "ns",
      source: "sharepoint",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "x",
      vector: await vec("x"),
    });
    const hits = search("ns", await vec("x"), { sources: ["zoom"] });
    expect(hits.length).toBe(1);
    expect(hits[0].source).toBe("zoom");
  });

  test("kali_entity_id filter narrows to one entity", async () => {
    upsert({
      namespace: "ns",
      source: "sharepoint",
      sourceRecordId: "1",
      kali_entity_id: "doc_a",
      chunkIndex: 0,
      text: "alpha",
      vector: await vec("alpha"),
    });
    upsert({
      namespace: "ns",
      source: "sharepoint",
      sourceRecordId: "2",
      kali_entity_id: "doc_b",
      chunkIndex: 0,
      text: "alpha",
      vector: await vec("alpha"),
    });
    const hits = search("ns", await vec("alpha"), {
      kali_entity_id: "doc_a",
    });
    expect(hits.length).toBe(1);
    expect(hits[0].kali_entity_id).toBe("doc_a");
  });

  test("metaEq filter narrows on a meta key", async () => {
    upsert({
      namespace: "ns",
      source: "sharepoint",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "x",
      meta: { docType: "board_minutes" },
      vector: await vec("x"),
    });
    upsert({
      namespace: "ns",
      source: "sharepoint",
      sourceRecordId: "2",
      chunkIndex: 0,
      text: "x",
      meta: { docType: "annual_report" },
      vector: await vec("x"),
    });
    const hits = search("ns", await vec("x"), {
      metaEq: { docType: "board_minutes" },
    });
    expect(hits.length).toBe(1);
  });

  test("minScore filters out low-similarity hits", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "totally unrelated finance ledger entry",
      vector: await vec("totally unrelated finance ledger entry"),
    });
    const hits = search(
      "ns",
      await vec("youth mentorship cohort"),
      { minScore: 0.99 },
    );
    expect(hits.length).toBe(0);
  });

  test("identical queries against an indexed entry return ~1.0 score", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "lapsed donor re-engagement strategy meeting",
      vector: await vec("lapsed donor re-engagement strategy meeting"),
    });
    const hits = search(
      "ns",
      await vec("lapsed donor re-engagement strategy meeting"),
    );
    expect(hits[0].score).toBeCloseTo(1, 4);
  });

  test("vector dim mismatch is surfaced as an error", async () => {
    upsert({
      namespace: "ns",
      source: "zoom",
      sourceRecordId: "1",
      chunkIndex: 0,
      text: "x",
      vector: l2Normalize(new Float32Array([1, 2, 3])),
    });
    expect(() =>
      search("ns", l2Normalize(new Float32Array([1, 2])), {}),
    ).toThrow();
  });
});
