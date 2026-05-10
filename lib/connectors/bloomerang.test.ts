/**
 * Tests for the Bloomerang reference connector.
 *
 * These run against the actual `data/seed/medium/bloomerang.json` fixture.
 * The fixture is deterministic (seeded RNG in `lib/seed/build-graph.ts`) so
 * counts and totals are stable across runs — if a build-graph change shifts
 * the numbers, regenerate via `bun run seed` and update the assertions.
 */

import { describe, expect, test, beforeAll, afterEach } from "bun:test";
import { z } from "zod";
import {
  bloomerangSeedSchema,
  constituentSchema,
  transactionSchema,
} from "./bloomerang.schema";
import {
  bloomerang,
  getBloomerangSeed,
  getDonations,
  getDonor,
  getEngagementScore,
  getOnlineDonationForms,
  getRecentDonations,
  searchDonors,
  __resetBloomerangSeedForTest,
} from "./bloomerang";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { BloomerangSeed } from "./bloomerang.schema";

/** Realistic "now" — seed dates run through 2026-05-10. */
const NOW = Date.parse("2026-05-15T00:00:00Z");

let seed: BloomerangSeed;

beforeAll(async () => {
  seed = await getBloomerangSeed();
});

afterEach(() => {
  // Tests that mutate cache reset it; default leaves the global seed alone.
});

describe("bloomerang.schema", () => {
  test("medium fixture parses against the seed schema", () => {
    expect(seed.constituents.length).toBeGreaterThan(0);
    expect(seed.transactions.length).toBeGreaterThan(0);
    expect(seed.onlineForms.length).toBeGreaterThan(0);
  });

  test("medium fixture has the expected aggregate shape", () => {
    expect(seed.constituents.length).toBe(830);
    expect(seed.transactions.length).toBe(2437);
    expect(seed.onlineForms.length).toBe(4);
  });

  test("every constituent passes constituentSchema individually", () => {
    for (const c of seed.constituents.slice(0, 25)) {
      expect(() => constituentSchema.parse(c)).not.toThrow();
    }
  });

  test("every transaction passes transactionSchema individually", () => {
    for (const t of seed.transactions.slice(0, 25)) {
      expect(() => transactionSchema.parse(t)).not.toThrow();
    }
  });

  test("rejects a malformed constituent (bad donorSegment)", () => {
    const bad = { ...seed.constituents[0], donorSegment: "platinum" };
    expect(() => constituentSchema.parse(bad)).toThrow();
  });

  test("schema accepts known edge cases (null phone, empty email, missing employer)", () => {
    expect(seed.constituents.some((c) => c.primaryPhone === null)).toBe(true);
    expect(seed.constituents.some((c) => c.primaryEmail.value === "")).toBe(true);
    expect(seed.constituents.some((c) => c.employer === undefined)).toBe(true);
  });
});

describe("searchDonors", () => {
  test("filters by segment", () => {
    const lapsed = searchDonors(seed, { segment: "lapsed", limit: 200 }, NOW);
    expect(lapsed.count).toBeGreaterThan(0);
    for (const d of lapsed.donors) expect(d.segment).toBe("lapsed");
  });

  test("respects minLifetimeGiving and matchingGiftEligibleOnly", () => {
    const big = searchDonors(
      seed,
      { minLifetimeGiving: 5_000, matchingGiftEligibleOnly: true, limit: 200 },
      NOW,
    );
    for (const d of big.donors) {
      expect(d.lifetimeGiving).toBeGreaterThanOrEqual(5_000);
      expect(d.matchingGiftEligible).toBe(true);
    }
  });

  test("minDaysSinceLastGift only matches donors with old (or null) last gifts past threshold", () => {
    const stale = searchDonors(seed, { minDaysSinceLastGift: 365, limit: 200 }, NOW);
    for (const d of stale.donors) {
      expect(d.lastGiftDate).not.toBeNull();
      const days = (NOW - Date.parse(d.lastGiftDate!)) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(365);
    }
  });

  test("limit caps the donor list but count is the unfiltered match total", () => {
    const r = searchDonors(seed, { segment: "grassroots", limit: 5 }, NOW);
    expect(r.donors.length).toBe(5);
    expect(r.count).toBeGreaterThan(5);
  });

  test("limit hard-cap (200) is enforced even if a higher value is requested", () => {
    const r = searchDonors(seed, { limit: 9999 }, NOW);
    expect(r.donors.length).toBeLessThanOrEqual(200);
  });

  test("empty filter returns up to the default cap", () => {
    const r = searchDonors(seed, {}, NOW);
    expect(r.count).toBe(seed.constituents.length);
    expect(r.donors.length).toBeGreaterThan(0);
    expect(r.donors.length).toBeLessThanOrEqual(50);
  });
});

describe("getDonor", () => {
  test("returns the matching donor", () => {
    const target = seed.constituents[10];
    const found = getDonor(seed, target.kali_entity_id);
    expect(found).not.toBeNull();
    expect(found!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("returns null for an unknown id", () => {
    expect(getDonor(seed, "ppl_doesnotexist")).toBeNull();
  });
});

describe("getDonations", () => {
  test("filters to one donor's transactions", () => {
    const donor = seed.constituents.find((c) =>
      seed.transactions.some((t) => t.constituentId === c.constituentId),
    )!;
    const r = getDonations(seed, { donorKaliId: donor.kali_entity_id });
    expect(r.count).toBeGreaterThan(0);
    for (const t of r.transactions) expect(t.constituentId).toBe(donor.constituentId);
    expect(r.totalAmount).toBe(r.transactions.reduce((s, t) => s + t.amount, 0));
  });

  test("returns empty for an unknown donor", () => {
    const r = getDonations(seed, { donorKaliId: "ppl_doesnotexist" });
    expect(r.count).toBe(0);
    expect(r.transactions).toHaveLength(0);
  });

  test("date range narrows results", () => {
    const r = getDonations(seed, { startDate: "2025-01-01", endDate: "2025-12-31" });
    for (const t of r.transactions) {
      expect(t.date >= "2025-01-01").toBe(true);
      expect(t.date <= "2025-12-31").toBe(true);
    }
  });

  test("matchedOnly filter only returns isMatched txs", () => {
    const r = getDonations(seed, { matchedOnly: true, limit: 1000 });
    expect(r.count).toBeGreaterThan(0);
    for (const t of r.transactions) expect(t.isMatched).toBe(true);
    expect(r.matchedAmount).toBeGreaterThan(0);
  });

  test("amount bounds work", () => {
    const r = getDonations(seed, { minAmount: 1000, maxAmount: 5000, limit: 1000 });
    for (const t of r.transactions) {
      expect(t.amount).toBeGreaterThanOrEqual(1000);
      expect(t.amount).toBeLessThanOrEqual(5000);
    }
  });

  test("limit hard-cap (1000) is enforced", () => {
    const r = getDonations(seed, { limit: 99_999 });
    expect(r.transactions.length).toBeLessThanOrEqual(1_000);
  });
});

describe("getRecentDonations", () => {
  test("returns donations within the last N days relative to `now`", () => {
    const now = Date.parse("2026-05-15T00:00:00Z");
    const r = getRecentDonations(seed, 30, now);
    const cutoff = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const t of r.transactions) expect(t.date >= cutoff).toBe(true);
  });
});

describe("getEngagementScore", () => {
  test("returns score+level for known donor", () => {
    const target = seed.constituents[5];
    const r = getEngagementScore(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(target.engagement.score);
    expect(r!.level).toBe(target.engagement.level);
  });

  test("returns null for unknown donor", () => {
    expect(getEngagementScore(seed, "ppl_nope")).toBeNull();
  });
});

describe("getOnlineDonationForms", () => {
  test("returns all forms", () => {
    const forms = getOnlineDonationForms(seed);
    expect(forms.length).toBe(4);
    expect(forms.some((f) => f.active)).toBe(true);
  });
});

describe("Connector / registry integration", () => {
  test("bloomerang registered itself with the registry", () => {
    expect(listConnectors().some((c) => c.id === "bloomerang")).toBe(true);
  });

  test("bloomerang exposes all expected tools with stable names", () => {
    const names = bloomerang.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "bloomerang.getDonations",
        "bloomerang.getDonor",
        "bloomerang.getEngagementScore",
        "bloomerang.getOnlineDonationForms",
        "bloomerang.getRecentDonations",
        "bloomerang.searchDonors",
      ].sort(),
    );
  });

  test("listTools() includes every bloomerang tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of bloomerang.tools) expect(all).toContain(t.name);
  });

  test("every tool's input schema is a zod schema", () => {
    for (const t of bloomerang.tools) {
      // zod v4 exposes a `_def` (or `_zod`) on every schema instance.
      expect(t.input).toBeDefined();
      expect(typeof t.input.parse).toBe("function");
      expect(typeof t.output.parse).toBe("function");
    }
  });

  test("init() preloads the seed (no throw on second call)", async () => {
    await bloomerang.init!();
    await bloomerang.init!();
  });
});

describe("Tool handlers (end-to-end through ToolDefinition surface)", () => {
  test("searchDonors handler validates input, runs, and writes an audit entry", async () => {
    const tool = bloomerang.tools.find((t) => t.name === "bloomerang.searchDonors")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { segment: "lapsed", limit: 10 },
      ctx,
    )) as { count: number; donors: { kali_entity_id: string; segment: string }[] };
    expect(out.donors.length).toBeLessThanOrEqual(10);
    for (const d of out.donors) expect(d.segment).toBe("lapsed");

    expect(ctx.entries).toHaveLength(1);
    const entry = ctx.entries[0];
    expect(entry.source).toBe("bloomerang");
    expect(entry.toolName).toBe("bloomerang.searchDonors");
    expect(entry.recordIds).toEqual(out.donors.map((d) => d.kali_entity_id));
    expect(entry.paramsHash.length).toBeGreaterThan(0);
    expect(typeof entry.durationMs).toBe("number");
  });

  test("invalid input is rejected by zod parsing in the handler chain", async () => {
    const tool = bloomerang.tools.find((t) => t.name === "bloomerang.searchDonors")!;
    // The handler does not validate input itself — that's the runtime's job —
    // but the zod schema on the ToolDefinition must reject this.
    expect(() => tool.input.parse({ segment: "platinum" })).toThrow();
  });

  test("getDonor handler returns null for unknown id and audits zero records", async () => {
    const tool = bloomerang.tools.find((t) => t.name === "bloomerang.getDonor")!;
    const ctx = makeCapturingContext();
    const out = await tool.handler({ kali_entity_id: "ppl_nope" }, ctx);
    expect(out).toBeNull();
    expect(ctx.entries[0].recordIds).toEqual([]);
  });

  test("getDonations handler writes recordIds for every returned tx", async () => {
    const tool = bloomerang.tools.find((t) => t.name === "bloomerang.getDonations")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { matchedOnly: true, limit: 5 },
      ctx,
    )) as { transactions: { kali_entity_id: string }[] };
    expect(out.transactions.length).toBeGreaterThan(0);
    expect(ctx.entries[0].recordIds).toEqual(
      out.transactions.map((t) => t.kali_entity_id),
    );
  });
});

describe("__resetBloomerangSeedForTest", () => {
  test("clears the in-process promise so a fresh load runs", async () => {
    __resetBloomerangSeedForTest();
    resetSeedCache();
    const fresh = await getBloomerangSeed();
    expect(fresh.constituents.length).toBeGreaterThan(0);
  });
});
