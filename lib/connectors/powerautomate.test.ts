/**
 * Tests for the Power Automate connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { powerAutomateFlowSchema } from "./powerautomate.schema";
import {
  findAutomationOpportunities,
  getFlow,
  getFlowRunHistory,
  getPowerAutomateSeed,
  listFlows,
  powerautomate,
  __resetPowerAutomateSeedForTest,
} from "./powerautomate";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { PowerAutomateSeed } from "./powerautomate.schema";

let seed: PowerAutomateSeed;

beforeAll(async () => {
  seed = await getPowerAutomateSeed();
});

describe("powerautomate.schema", () => {
  test("medium fixture has 12 flows", () => {
    expect(seed.flows.length).toBe(12);
  });

  test("schemas accept rows", () => {
    expect(() => powerAutomateFlowSchema.parse(seed.flows[0])).not.toThrow();
  });
});

describe("listFlows", () => {
  test("returns all flows by default with summary", () => {
    const r = listFlows(seed);
    expect(r.count).toBe(seed.flows.length);
    for (const f of r.flows) {
      expect(f.totalRuns).toBe(f.succeeded + f.failed);
    }
  });

  test("activeOnly filter", () => {
    const r = listFlows(seed, { activeOnly: true });
    for (const f of r.flows) expect(f.state).toBe("Started");
  });

  test("triggerContains filter (case insensitive)", () => {
    const target = seed.flows[0];
    const word = target.trigger.split(/[\s:]+/)[0];
    const r = listFlows(seed, { triggerContains: word.toUpperCase() });
    expect(r.flows.some((f) => f.kali_entity_id === target.kali_entity_id)).toBe(true);
  });
});

describe("getFlow", () => {
  test("returns a known flow", () => {
    const target = seed.flows[2];
    const r = getFlow(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.runs.history.length).toBeGreaterThanOrEqual(0);
  });

  test("null for unknown id", () => {
    expect(getFlow(seed, "flow_nope")).toBeNull();
  });
});

describe("getFlowRunHistory", () => {
  test("returns run history sorted newest-first", () => {
    const flow = seed.flows.find((f) => f.runs.history.length > 0)!;
    const r = getFlowRunHistory(seed, { kali_entity_id: flow.kali_entity_id });
    expect(r).not.toBeNull();
    for (let i = 1; i < r!.runs.length; i++) {
      expect(r!.runs[i].date <= r!.runs[i - 1].date).toBe(true);
    }
  });

  test("sinceDate filter", () => {
    const flow = seed.flows.find((f) => f.runs.history.length > 0)!;
    const r = getFlowRunHistory(seed, {
      kali_entity_id: flow.kali_entity_id,
      sinceDate: "2025-06-01",
    });
    for (const run of r!.runs) expect(run.date >= "2025-06-01").toBe(true);
  });

  test("returns null for unknown flow", () => {
    expect(getFlowRunHistory(seed, { kali_entity_id: "flow_nope" })).toBeNull();
  });
});

describe("findAutomationOpportunities", () => {
  test("flags high-failure flows", () => {
    const r = findAutomationOpportunities(seed);
    for (const o of r.opportunities) {
      if (o.kind === "high_failure") {
        const flow = seed.flows.find((f) => f.kali_entity_id === o.flowKaliId)!;
        expect(flow.runs.failed / flow.runs.total).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  test("each opportunity has a rationale + flow reference", () => {
    const r = findAutomationOpportunities(seed);
    for (const o of r.opportunities) {
      expect(o.rationale.length).toBeGreaterThan(0);
      expect(o.kind.length).toBeGreaterThan(0);
    }
  });
});

describe("Connector / registry integration", () => {
  test("powerautomate registered itself", () => {
    expect(listConnectors().some((c) => c.id === "powerautomate")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = powerautomate.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "powerautomate.findAutomationOpportunities",
        "powerautomate.getFlow",
        "powerautomate.getFlowRunHistory",
        "powerautomate.listFlows",
      ].sort(),
    );
  });

  test("listTools() includes every powerautomate tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of powerautomate.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await powerautomate.init!();
    await powerautomate.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("listFlows handler audits", async () => {
    const tool = powerautomate.tools.find((t) => t.name === "powerautomate.listFlows")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({ activeOnly: true }, ctx)) as {
      flows: { kali_entity_id: string }[];
    };
    expect(ctx.entries[0].source).toBe("powerautomate");
    expect(ctx.entries[0].recordIds).toEqual(out.flows.map((f) => f.kali_entity_id));
  });
});

describe("__resetPowerAutomateSeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetPowerAutomateSeedForTest();
    resetSeedCache();
    const fresh = await getPowerAutomateSeed();
    expect(fresh.flows.length).toBeGreaterThan(0);
  });
});
