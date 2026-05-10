import { describe, expect, test } from "bun:test";
import {
  cosineSim,
  FakeEmbedder,
  l2Normalize,
} from "./embed";

describe("l2Normalize", () => {
  test("returns a unit vector", () => {
    const v = new Float32Array([3, 4]);
    const out = l2Normalize(v);
    expect(out[0]).toBeCloseTo(0.6, 5);
    expect(out[1]).toBeCloseTo(0.8, 5);
    let n = 0;
    for (let i = 0; i < out.length; i++) n += out[i] * out[i];
    expect(n).toBeCloseTo(1, 5);
  });

  test("zero vector stays zero", () => {
    const v = new Float32Array([0, 0, 0]);
    const out = l2Normalize(v);
    expect(out[0]).toBe(0);
  });
});

describe("cosineSim", () => {
  test("identical normalized vectors return ~1", () => {
    const v = l2Normalize(new Float32Array([1, 2, 3]));
    expect(cosineSim(v, v)).toBeCloseTo(1, 5);
  });

  test("orthogonal vectors return ~0", () => {
    const a = l2Normalize(new Float32Array([1, 0]));
    const b = l2Normalize(new Float32Array([0, 1]));
    expect(cosineSim(a, b)).toBeCloseTo(0, 5);
  });

  test("opposite vectors return ~-1", () => {
    const a = l2Normalize(new Float32Array([1, 0]));
    const b = l2Normalize(new Float32Array([-1, 0]));
    expect(cosineSim(a, b)).toBeCloseTo(-1, 5);
  });

  test("dim mismatch throws", () => {
    expect(() =>
      cosineSim(new Float32Array([1, 0]), new Float32Array([1, 0, 0])),
    ).toThrow();
  });
});

describe("FakeEmbedder", () => {
  const embedder = new FakeEmbedder();

  test("produces a unit vector of the configured dim", async () => {
    const v = await embedder.embed("hello world");
    expect(v.length).toBe(embedder.dim);
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    expect(n).toBeCloseTo(1, 4);
  });

  test("identical inputs produce identical vectors (deterministic)", async () => {
    const a = await embedder.embed("youth mentorship cohort");
    const b = await embedder.embed("youth mentorship cohort");
    expect(cosineSim(a, b)).toBeCloseTo(1, 5);
  });

  test("similar topics rank higher than unrelated topics", async () => {
    const target = await embedder.embed(
      "youth mentorship after-school cohort tutoring kids",
    );
    const close = await embedder.embed(
      "after-school youth tutoring cohort mentorship",
    );
    const far = await embedder.embed(
      "quarterly financial statement budget reconciliation accounting ledger",
    );
    expect(cosineSim(target, close)).toBeGreaterThan(cosineSim(target, far));
  });

  test("embedMany returns vectors in input order", async () => {
    const out = await embedder.embedMany(["alpha", "beta", "gamma"]);
    expect(out).toHaveLength(3);
    const a = await embedder.embed("alpha");
    expect(cosineSim(out[0], a)).toBeCloseTo(1, 5);
  });
});
