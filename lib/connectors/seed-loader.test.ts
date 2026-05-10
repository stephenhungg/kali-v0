import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadSeed, resetSeedCache, seedCacheSize } from "./seed-loader";

const TMP = path.join(process.cwd(), ".tmp", "seed-loader-test");

const fooSchema = z.object({
  hello: z.string(),
  count: z.number(),
});

beforeEach(async () => {
  resetSeedCache();
  await rm(TMP, { recursive: true, force: true });
  for (const size of ["small", "medium", "large"] as const) {
    await mkdir(path.join(TMP, size), { recursive: true });
    await writeFile(
      path.join(TMP, size, "foo.json"),
      JSON.stringify({ hello: size, count: size === "large" ? 1000 : 1 }),
    );
  }
});

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe("loadSeed", () => {
  test("reads + validates the medium fixture by default", async () => {
    const data = await loadSeed("foo", fooSchema, { baseDir: TMP });
    expect(data.hello).toBe("medium");
    expect(data.count).toBe(1);
  });

  test("respects an explicit size", async () => {
    const data = await loadSeed("foo", fooSchema, { baseDir: TMP, size: "large" });
    expect(data.hello).toBe("large");
    expect(data.count).toBe(1000);
  });

  test("respects KALI_SEED_SIZE when no size passed", async () => {
    const prev = process.env.KALI_SEED_SIZE;
    process.env.KALI_SEED_SIZE = "small";
    try {
      resetSeedCache();
      const data = await loadSeed("foo", fooSchema, { baseDir: TMP });
      expect(data.hello).toBe("small");
    } finally {
      if (prev === undefined) delete process.env.KALI_SEED_SIZE;
      else process.env.KALI_SEED_SIZE = prev;
    }
  });

  test("caches by (baseDir, size, connectorId) — second call doesn't re-read", async () => {
    const a = await loadSeed("foo", fooSchema, { baseDir: TMP });
    expect(seedCacheSize()).toBe(1);
    // Mutate the file on disk; cached read should not pick it up.
    await writeFile(path.join(TMP, "medium", "foo.json"), JSON.stringify({ hello: "MUTATED", count: 42 }));
    const b = await loadSeed("foo", fooSchema, { baseDir: TMP });
    expect(b).toBe(a); // same reference — pure cache hit
    expect(seedCacheSize()).toBe(1);
  });

  test("different size populates a separate cache entry", async () => {
    await loadSeed("foo", fooSchema, { baseDir: TMP, size: "small" });
    await loadSeed("foo", fooSchema, { baseDir: TMP, size: "medium" });
    expect(seedCacheSize()).toBe(2);
  });

  test("schema mismatch throws a ZodError", async () => {
    const wrongSchema = z.object({ hello: z.number(), count: z.string() });
    await expect(
      loadSeed("foo", wrongSchema, { baseDir: TMP }),
    ).rejects.toThrow();
  });

  test("missing file surfaces a filesystem error", async () => {
    await expect(
      loadSeed("missing-connector", fooSchema, { baseDir: TMP }),
    ).rejects.toThrow();
  });
});
