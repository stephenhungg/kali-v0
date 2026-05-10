/**
 * Reads `data/seed/<tool>.json`, validates against the connector's zod schema,
 * caches in memory. Connectors call this from their `init()` hook.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

const cache = new Map<string, unknown>();

const SEED_DIR = path.join(process.cwd(), "data", "seed");

export async function loadSeed<TSchema extends z.ZodTypeAny>(
  connectorId: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const cached = cache.get(connectorId);
  if (cached !== undefined) {
    return cached as z.infer<TSchema>;
  }

  const seedPath = path.join(SEED_DIR, `${connectorId}.json`);
  const raw = await readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw);
  const validated = schema.parse(parsed);
  cache.set(connectorId, validated);
  return validated;
}

/** Test/dev-only: clear the seed cache. */
export function resetSeedCache(): void {
  cache.clear();
}
