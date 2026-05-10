/**
 * Drizzle client (Postgres). Lazily constructed on first import — env var
 * `DATABASE_URL` is required. For unit tests / scripts that don't need a
 * real DB, import `{ memoryStore }` from `lib/db/memory.ts` instead.
 *
 * Usage:
 *   import { db } from "@/lib/db/client";
 *   import { x402Receipts } from "@/lib/db/schema";
 *   await db.insert(x402Receipts).values({...});
 *
 * Production: pgvector + Neon. Single connection per process; the driver
 * handles pooling via `node-postgres`.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _db: NodePgDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set — required for the Drizzle client. Use lib/db/memory.ts for in-process tests.",
    );
  }
  _pool = new Pool({ connectionString: url, max: 10 });
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (_db) return _db;
  _db = drizzle(getPool(), { schema, casing: "snake_case" });
  return _db;
}

// Convenience export — most call sites can `import { db }` and the lazy
// init runs on first property access.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };
