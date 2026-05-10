/**
 * Reads `data/seed/<size>/<connectorId>.json`, validates against a zod schema,
 * caches in memory. Connectors call this from their `init()` hook.
 *
 * The seed generator (`scripts/generate-seed.ts`) produces three sized fixtures:
 * `small`, `medium`, `large`. We default to `medium` for the demo. The active
 * size can be overridden per-call (for tests) or via `KALI_SEED_SIZE`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

export type SeedSize = "small" | "medium" | "large";

export interface LoadSeedOptions {
  /** Which fixture to read. Defaults to `KALI_SEED_SIZE` env, then `medium`. */
  size?: SeedSize;
  /** Override the seed root (defaults to `<cwd>/data/seed`). Used by tests. */
  baseDir?: string;
}

const cache = new Map<string, unknown>();

function defaultBaseDir(): string {
  return path.join(process.cwd(), "data", "seed");
}

function resolveSize(size: SeedSize | undefined): SeedSize {
  if (size) return size;
  const env = process.env.KALI_SEED_SIZE;
  if (env === "small" || env === "medium" || env === "large") return env;
  return "medium";
}

function cacheKey(connectorId: string, size: SeedSize, baseDir: string): string {
  return `${baseDir}::${size}::${connectorId}`;
}

export async function loadSeed<TSchema extends z.ZodTypeAny>(
  connectorId: string,
  schema: TSchema,
  options: LoadSeedOptions = {},
): Promise<z.infer<TSchema>> {
  const size = resolveSize(options.size);
  const baseDir = options.baseDir ?? defaultBaseDir();
  const key = cacheKey(connectorId, size, baseDir);

  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached as z.infer<TSchema>;
  }

  const seedPath = path.join(baseDir, size, `${connectorId}.json`);
  const raw = await readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw);
  const validated = schema.parse(parsed);
  cache.set(key, validated);
  return validated;
}

/** Test/dev-only: clear the seed cache (all keys). */
export function resetSeedCache(): void {
  cache.clear();
}

/** Test/dev-only: peek at the cache size for assertions. */
export function seedCacheSize(): number {
  return cache.size;
}
