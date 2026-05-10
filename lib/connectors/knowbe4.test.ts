/**
 * Tests for the KnowBe4 connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  knowBe4OrgPostureSchema,
  knowBe4UserResultSchema,
} from "./knowbe4.schema";
import {
  getKnowBe4Seed,
  getOrgPosture,
  getPhishingResults,
  getRecentIncidents,
  getTrainingCompletion,
  getUser,
  getUserRiskScores,
  knowbe4,
  __resetKnowBe4SeedForTest,
} from "./knowbe4";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { KnowBe4Seed } from "./knowbe4.schema";

let seed: KnowBe4Seed;

beforeAll(async () => {
  seed = await getKnowBe4Seed();
});

describe("knowbe4.schema", () => {
  test("medium fixture has 22 user results", () => {
    expect(seed.userResults.length).toBe(22);
  });

  test("schemas accept rows", () => {
    expect(() => knowBe4UserResultSchema.parse(seed.userResults[0])).not.toThrow();
    expect(() => knowBe4OrgPostureSchema.parse(seed.orgPosture)).not.toThrow();
  });
});

describe("getOrgPosture", () => {
  test("returns the org posture object", () => {
    const r = getOrgPosture(seed);
    expect(r.overallRisk).toBeGreaterThan(0);
    expect(r.flaggedUserCount).toBeGreaterThanOrEqual(0);
  });
});

describe("getUserRiskScores", () => {
  test("default sort is risk descending", () => {
    const r = getUserRiskScores(seed, { limit: 100 });
    for (let i = 1; i < r.users.length; i++) {
      expect(r.users[i].riskScore).toBeLessThanOrEqual(r.users[i - 1].riskScore);
    }
  });

  test("department filter (case insensitive)", () => {
    const dept = seed.userResults[0].department;
    const r = getUserRiskScores(seed, { department: dept.toUpperCase() });
    for (const u of r.users) expect(u.department.toLowerCase()).toBe(dept.toLowerCase());
  });

  test("minRiskScore narrows", () => {
    const r = getUserRiskScores(seed, { minRiskScore: 60, limit: 100 });
    for (const u of r.users) expect(u.riskScore).toBeGreaterThanOrEqual(60);
  });

  test("maxTrainingCompletion narrows to under-trained staff", () => {
    const r = getUserRiskScores(seed, { maxTrainingCompletion: 80, limit: 100 });
    for (const u of r.users) expect(u.trainingCompletionPercent).toBeLessThanOrEqual(80);
  });
});

describe("getUser / getTrainingCompletion", () => {
  test("getUser returns full record", () => {
    const target = seed.userResults[0];
    const r = getUser(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("getUser null for unknown id", () => {
    expect(getUser(seed, "ppl_nope")).toBeNull();
  });

  test("getTrainingCompletion returns percent", () => {
    const target = seed.userResults[0];
    const r = getTrainingCompletion(seed, target.kali_entity_id);
    expect(r!.trainingCompletionPercent).toBe(target.trainingCompletionPercent);
  });

  test("getTrainingCompletion null for unknown id", () => {
    expect(getTrainingCompletion(seed, "ppl_nope")).toBeNull();
  });
});

describe("getPhishingResults", () => {
  test("counts add up", () => {
    const r = getPhishingResults(seed, {});
    expect(r.passed + r.failedClicked + r.failedCredentials).toBe(r.total);
  });

  test("passRate is between 0 and 1", () => {
    const r = getPhishingResults(seed, {});
    expect(r.passRate).toBeGreaterThanOrEqual(0);
    expect(r.passRate).toBeLessThanOrEqual(1);
  });

  test("date window narrows results", () => {
    const r = getPhishingResults(seed, {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    if (r.startDate) expect(r.startDate >= "2026-01-01").toBe(true);
    if (r.endDate) expect(r.endDate <= "2026-12-31").toBe(true);
  });
});

describe("getRecentIncidents", () => {
  test("returns flagged incidents with reason + date", () => {
    const r = getRecentIncidents(seed, {});
    expect(r.count).toBeGreaterThan(0);
    for (const i of r.incidents) expect(i.reason.length).toBeGreaterThan(0);
  });

  test("sorted newest first", () => {
    const r = getRecentIncidents(seed, { limit: 100 });
    for (let i = 1; i < r.incidents.length; i++) {
      expect(r.incidents[i].date <= r.incidents[i - 1].date).toBe(true);
    }
  });

  test("sinceDate filter", () => {
    const r = getRecentIncidents(seed, { sinceDate: "2026-04-01" });
    for (const i of r.incidents) expect(i.date >= "2026-04-01").toBe(true);
  });
});

describe("Connector / registry integration", () => {
  test("knowbe4 registered itself", () => {
    expect(listConnectors().some((c) => c.id === "knowbe4")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = knowbe4.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "knowbe4.getOrgPosture",
        "knowbe4.getPhishingResults",
        "knowbe4.getRecentIncidents",
        "knowbe4.getTrainingCompletion",
        "knowbe4.getUser",
        "knowbe4.getUserRiskScores",
      ].sort(),
    );
  });

  test("listTools() includes every knowbe4 tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of knowbe4.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await knowbe4.init!();
    await knowbe4.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("getUserRiskScores handler audits", async () => {
    const tool = knowbe4.tools.find((t) => t.name === "knowbe4.getUserRiskScores")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({ minRiskScore: 50, limit: 5 }, ctx)) as {
      users: { kali_entity_id: string; riskScore: number }[];
    };
    expect(ctx.entries[0].source).toBe("knowbe4");
    expect(ctx.entries[0].recordIds).toEqual(out.users.map((u) => u.kali_entity_id));
  });
});

describe("__resetKnowBe4SeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetKnowBe4SeedForTest();
    resetSeedCache();
    const fresh = await getKnowBe4Seed();
    expect(fresh.userResults.length).toBeGreaterThan(0);
  });
});
