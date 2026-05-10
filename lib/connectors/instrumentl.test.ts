/**
 * Tests for the Instrumentl connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { funderSchema, grantSchema } from "./instrumentl.schema";
import {
  getDeadlinesInRange,
  getFunderProfile,
  getGrant,
  getInstrumentlSeed,
  getMatchScore,
  getTrackedGrants,
  instrumentl,
  searchFunders,
  searchGrants,
  __resetInstrumentlSeedForTest,
} from "./instrumentl";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { InstrumentlSeed } from "./instrumentl.schema";

let seed: InstrumentlSeed;

beforeAll(async () => {
  seed = await getInstrumentlSeed();
});

describe("instrumentl.schema", () => {
  test("medium fixture has expected shape", () => {
    expect(seed.grants.length).toBe(38);
    expect(seed.funders.length).toBe(28);
  });

  test("schemas accept individual rows", () => {
    expect(() => grantSchema.parse(seed.grants[0])).not.toThrow();
    expect(() => funderSchema.parse(seed.funders[0])).not.toThrow();
  });

  test("known edge cases (null awardedAmount, missing optional fields) accepted", () => {
    expect(seed.grants.some((g) => g.awardedAmount === null)).toBe(true);
    expect(seed.grants.some((g) => g.programArea === undefined)).toBe(true);
    expect(seed.grants.some((g) => g.notes === undefined)).toBe(true);
  });

  test("rejects an unknown status", () => {
    const bad = { ...seed.grants[0], status: "denied" };
    expect(() => grantSchema.parse(bad)).toThrow();
  });
});

describe("searchGrants", () => {
  test("filters by status", () => {
    const r = searchGrants(seed, { status: "awarded", limit: 200 });
    for (const g of r.grants) expect(g.status).toBe("awarded");
  });

  test("filters by funder kaliId", () => {
    const target = seed.grants[0];
    const r = searchGrants(seed, { funderKaliId: target.funderId, limit: 200 });
    for (const g of r.grants) expect(g.funderId).toBe(target.funderId);
  });

  test("minFitScore narrows results", () => {
    const r = searchGrants(seed, { minFitScore: 80, limit: 200 });
    for (const g of r.grants) expect(g.fitScore).toBeGreaterThanOrEqual(80);
  });

  test("minRequestedAmount narrows results", () => {
    const r = searchGrants(seed, { minRequestedAmount: 50_000, limit: 200 });
    for (const g of r.grants) expect(g.requestedAmount).toBeGreaterThanOrEqual(50_000);
  });

  test("fundingFocus matches grant's fundingFocus list (substring, case-insensitive)", () => {
    const target = seed.grants.find((g) => g.fundingFocus.length > 0);
    if (!target) return;
    const focus = target.fundingFocus[0];
    const r = searchGrants(seed, { fundingFocus: focus.toUpperCase(), limit: 200 });
    expect(r.count).toBeGreaterThan(0);
  });
});

describe("getGrant", () => {
  test("returns a known grant", () => {
    const target = seed.grants[2];
    const r = getGrant(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("returns null for unknown id", () => {
    expect(getGrant(seed, "grant_nope")).toBeNull();
  });
});

describe("getTrackedGrants", () => {
  test("only includes the active pipeline statuses", () => {
    const r = getTrackedGrants(seed, { limit: 500 });
    for (const g of r.grants) {
      expect(["in_progress", "submitted", "awarded", "active", "reporting"]).toContain(g.status);
    }
  });

  test("count equals all matching grants regardless of limit", () => {
    const r = getTrackedGrants(seed, { limit: 1 });
    const allTracked = seed.grants.filter((g) =>
      ["in_progress", "submitted", "awarded", "active", "reporting"].includes(g.status),
    );
    expect(r.count).toBe(allTracked.length);
    expect(r.grants.length).toBe(1);
  });
});

describe("getDeadlinesInRange", () => {
  test("only includes grants with future deadlines within window", () => {
    const now = Date.parse("2026-05-15T00:00:00Z");
    const r = getDeadlinesInRange(seed, { days: 365 }, now);
    const today = new Date(now).toISOString().slice(0, 10);
    const cutoff = new Date(now + 365 * 86_400_000).toISOString().slice(0, 10);
    for (const d of r.deadlines) {
      expect(d.deadline >= today).toBe(true);
      expect(d.deadline <= cutoff).toBe(true);
      expect(d.daysUntilDeadline).toBeGreaterThanOrEqual(0);
    }
  });

  test("results sorted ascending by deadline", () => {
    const now = Date.parse("2026-05-15T00:00:00Z");
    const r = getDeadlinesInRange(seed, { days: 1000 }, now);
    for (let i = 1; i < r.deadlines.length; i++) {
      expect(r.deadlines[i].deadline >= r.deadlines[i - 1].deadline).toBe(true);
    }
  });

  test("days=0 returns no future deadlines", () => {
    const now = Date.parse("2026-05-15T00:00:00Z");
    const r = getDeadlinesInRange(seed, { days: 0 }, now);
    // only deadlines that fall exactly today match — typically 0
    for (const d of r.deadlines) expect(d.deadline).toBe("2026-05-15");
  });
});

describe("getFunderProfile", () => {
  test("returns a known funder", () => {
    const target = seed.funders[0];
    const r = getFunderProfile(seed, target.funderId);
    expect(r).not.toBeNull();
    expect(r!.funderId).toBe(target.funderId);
  });

  test("returns null for unknown funder", () => {
    expect(getFunderProfile(seed, "org_nope")).toBeNull();
  });
});

describe("getMatchScore", () => {
  test("returns the grant's fit score + funding focus", () => {
    const target = seed.grants[1];
    const r = getMatchScore(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.fitScore).toBe(target.fitScore);
    expect(r!.fundingFocus).toEqual(target.fundingFocus);
  });

  test("returns null for unknown grant", () => {
    expect(getMatchScore(seed, "grant_nope")).toBeNull();
  });
});

describe("searchFunders", () => {
  test("filters by type", () => {
    const r = searchFunders(seed, { type: "foundation" });
    for (const f of r.funders) expect(f.type).toBe("foundation");
  });

  test("fundingFocus substring matches", () => {
    const target = seed.funders.find((f) => f.fundingFocus.length > 0);
    if (!target) return;
    const r = searchFunders(seed, { fundingFocus: target.fundingFocus[0].toUpperCase() });
    expect(r.count).toBeGreaterThan(0);
  });
});

describe("Connector / registry integration", () => {
  test("instrumentl registered itself", () => {
    expect(listConnectors().some((c) => c.id === "instrumentl")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = instrumentl.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "instrumentl.getDeadlinesInRange",
        "instrumentl.getFunderProfile",
        "instrumentl.getGrant",
        "instrumentl.getMatchScore",
        "instrumentl.getTrackedGrants",
        "instrumentl.searchFunders",
        "instrumentl.searchGrants",
      ].sort(),
    );
  });

  test("listTools() includes every instrumentl tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of instrumentl.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await instrumentl.init!();
    await instrumentl.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("getDeadlinesInRange handler audits", async () => {
    const tool = instrumentl.tools.find((t) => t.name === "instrumentl.getDeadlinesInRange")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({ days: 365, limit: 5 }, ctx)) as {
      deadlines: { kali_entity_id: string }[];
    };
    expect(ctx.entries[0].source).toBe("instrumentl");
    expect(ctx.entries[0].toolName).toBe("instrumentl.getDeadlinesInRange");
    expect(ctx.entries[0].recordIds).toEqual(out.deadlines.map((d) => d.kali_entity_id));
  });
});

describe("__resetInstrumentlSeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetInstrumentlSeedForTest();
    resetSeedCache();
    const fresh = await getInstrumentlSeed();
    expect(fresh.grants.length).toBeGreaterThan(0);
  });
});
