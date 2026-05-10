/**
 * Cross-source structured query DSL.
 *
 * The agent's tool surface already covers structured queries inside a
 * single connector. The wow-queries in v1-prototype-scope.md §6 need
 * INTERSECTIONS across connectors, e.g. "lapsed donors AND attended ≥ 2
 * events AND employer has matching gifts" — three sources, joined by
 * kali_entity_id.
 *
 * `context.query` lets the agent express that intersection in one call:
 *
 *   {
 *     filters: [
 *       { source: "bloomerang",  path: "donorSegment",                    op: "=",  value: "lapsed" },
 *       { source: "bloomerang",  path: "lifetimeGiving",                  op: ">=", value: 1000  },
 *       { source: "salesforce",  path: "npsp__Major_Donor__c",            op: "=",  value: true  },
 *       { source: "zoom",        path: "$attendanceCount",                op: ">=", value: 2     },
 *     ],
 *     limit: 25,
 *   }
 *
 * The executor:
 *   1. For each filter, builds a Set<kali_entity_id> of candidates from
 *      that source's seed.
 *   2. Intersects every Set.
 *   3. Hydrates each surviving entity to a unified profile.
 *
 * `path` is a dotted property path inside the source's record shape. A
 * leading `$` enables a small set of computed fields the seeds don't
 * carry directly (e.g. `$attendanceCount` for zoom).
 */

import { getBloomerangSeed } from "../connectors/bloomerang";
import { getSalesforceSeed } from "../connectors/salesforce";
import { getM365Seed } from "../connectors/m365";
import { getZoomSeed } from "../connectors/zoom";
import { getInstrumentlSeed } from "../connectors/instrumentl";
import { getKnowBe4Seed } from "../connectors/knowbe4";
import { entityProfile, type EntityProfile } from "./entityResolver";

export type QuerySource =
  | "bloomerang"
  | "salesforce"
  | "m365"
  | "zoom"
  | "instrumentl"
  | "knowbe4";

export type QueryOp =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "contains"
  | "exists";

export interface QueryFilter {
  source: QuerySource;
  /** Dotted property path or a `$<computed>` virtual field. */
  path: string;
  op: QueryOp;
  /** Right-hand operand. For `in` should be an array. For `exists` ignored. */
  value?: unknown;
}

export interface QueryArgs {
  filters: QueryFilter[];
  limit?: number;
}

export interface QueryResult {
  count: number;
  filtersApplied: number;
  /** Per-source candidate counts BEFORE intersection — useful for debugging. */
  perSourceCounts: Record<string, number>;
  entityIds: string[];
  profiles: EntityProfile[];
}

/* ─── small helpers ──────────────────────────────────────────────────── */

function getPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compare(left: unknown, op: QueryOp, right: unknown): boolean {
  // Treat null/undefined as "field not present". Most operators should
  // return false in that case so a typo in a field path doesn't match
  // every row in the corpus.
  switch (op) {
    case "exists":
      return left !== undefined && left !== null;
    case "=":
      return left === right;
    case "!=":
      // STRICT: a missing field is not a match for "!=". Otherwise typos
      // like `donorSegmnt != "lapsed"` flag every row.
      if (left === undefined || left === null) return false;
      return left !== right;
    case ">":
      return typeof left === "number" && typeof right === "number" && left > right;
    case ">=":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "<":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "<=":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "in":
      if (left === undefined || left === null) return false;
      return Array.isArray(right) && right.includes(left);
    case "contains":
      // Empty string matches everything → reject explicitly.
      if (typeof right === "string" && right.length === 0) return false;
      if (typeof left === "string" && typeof right === "string")
        return left.toLowerCase().includes(right.toLowerCase());
      if (Array.isArray(left)) return left.includes(right);
      return false;
  }
}

/* ─── per-source candidate enumerators ────────────────────────────────── */

interface RowAccessor {
  kaliEntityId: string;
  /** Get the value at `path` from this row. Supports `$computed` virtuals. */
  get(path: string): unknown;
}

async function rowsForSource(source: QuerySource): Promise<RowAccessor[]> {
  switch (source) {
    case "bloomerang": {
      const seed = await getBloomerangSeed();
      return seed.constituents.map((c) => ({
        kaliEntityId: c.kali_entity_id,
        get: (p: string) => getPath(c, p),
      }));
    }
    case "salesforce": {
      const seed = await getSalesforceSeed();
      const accountById = new Map(seed.accounts.map((a) => [a.Id, a]));
      return seed.contacts.map((c) => ({
        kaliEntityId: c.kali_entity_id,
        get: (p: string) => {
          if (p === "$employer") {
            return c.AccountId ? accountById.get(c.AccountId) : null;
          }
          if (p === "$employerHasMatchingGifts") {
            const acc = c.AccountId ? accountById.get(c.AccountId) : null;
            return !!acc?.npsp__Matching_Gift_Account__c;
          }
          return getPath(c, p);
        },
      }));
    }
    case "m365": {
      const seed = await getM365Seed();
      return seed.users.map((u) => ({
        kaliEntityId: u.kali_entity_id,
        get: (p: string) => getPath(u, p),
      }));
    }
    case "zoom": {
      const seed = await getZoomSeed();
      // Aggregate per-attendee: we want fields like $attendanceCount.
      const counts = new Map<string, number>();
      for (const m of seed.meetings) {
        for (const p of m.participants) {
          counts.set(p.userId, (counts.get(p.userId) ?? 0) + 1);
        }
      }
      const out: RowAccessor[] = [];
      for (const [kid, count] of counts.entries()) {
        out.push({
          kaliEntityId: kid,
          get: (p: string) => {
            if (p === "$attendanceCount") return count;
            return undefined;
          },
        });
      }
      return out;
    }
    case "instrumentl": {
      const seed = await getInstrumentlSeed();
      return seed.grants.map((g) => ({
        kaliEntityId: g.kali_entity_id,
        get: (p: string) => getPath(g, p),
      }));
    }
    case "knowbe4": {
      const seed = await getKnowBe4Seed();
      return seed.userResults.map((u) => ({
        kaliEntityId: u.kali_entity_id,
        get: (p: string) => getPath(u, p),
      }));
    }
  }
}

/**
 * Apply one filter to its source. Returns the set of kali_entity_ids that
 * pass.
 */
async function candidatesFor(filter: QueryFilter): Promise<Set<string>> {
  const rows = await rowsForSource(filter.source);
  const out = new Set<string>();
  for (const r of rows) {
    if (compare(r.get(filter.path), filter.op, filter.value)) {
      out.add(r.kaliEntityId);
    }
  }
  return out;
}

function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const sorted = [...sets].sort((a, b) => a.size - b.size);
  const out = new Set<string>();
  for (const id of sorted[0]) {
    if (sorted.every((s) => s.has(id))) out.add(id);
  }
  return out;
}

/**
 * Run the cross-source query.
 */
export async function runQuery(args: QueryArgs): Promise<QueryResult> {
  if (args.filters.length === 0) {
    return {
      count: 0,
      filtersApplied: 0,
      perSourceCounts: {},
      entityIds: [],
      profiles: [],
    };
  }

  const limit = Math.min(args.limit ?? 25, 200);
  const candSets: Set<string>[] = [];
  const perSourceCounts: Record<string, number> = {};
  for (const f of args.filters) {
    const set = await candidatesFor(f);
    candSets.push(set);
    const key = `${f.source}.${f.path}`;
    perSourceCounts[key] = set.size;
  }
  const surviving = intersect(candSets);
  const entityIds = Array.from(surviving).slice(0, limit);
  const profiles = await Promise.all(
    entityIds.map(async (id) => entityProfile(id)),
  );
  return {
    count: surviving.size,
    filtersApplied: args.filters.length,
    perSourceCounts,
    entityIds,
    profiles: profiles.filter((p): p is EntityProfile => p !== null),
  };
}
