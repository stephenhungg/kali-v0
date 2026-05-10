/**
 * Power Automate connector — workflow automation discovery + run history.
 *
 * Powers the F8.4 automation-discovery wow-query: agent inspects active
 * flows, success/failure rates, and looks for missing automations
 * (e.g. high-volume email patterns without a corresponding flow).
 *
 * Real-OAuth path: Power Automate Management API. Read-only for v1.
 * Writing new flows from Kali is post-v1.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  powerAutomateFlowSchema,
  powerAutomateRunSchema,
  powerAutomateSeedSchema,
  type PowerAutomateFlow,
  type PowerAutomateSeed,
} from "./powerautomate.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<PowerAutomateSeed> | null = null;

export async function getPowerAutomateSeed(size?: SeedSize): Promise<PowerAutomateSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("powerAutomate", powerAutomateSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetPowerAutomateSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

export interface FlowSummary {
  kali_entity_id: string;
  displayName: string;
  description: string;
  trigger: string;
  state: PowerAutomateFlow["state"];
  ownerId: string;
  totalRuns: number;
  succeeded: number;
  failed: number;
  failureRate: number;
  avgDurationMs: number;
}

function toFlowSummary(f: PowerAutomateFlow): FlowSummary {
  const total = f.runs.total;
  return {
    kali_entity_id: f.kali_entity_id,
    displayName: f.displayName,
    description: f.description,
    trigger: f.trigger,
    state: f.state,
    ownerId: f.ownerId,
    totalRuns: total,
    succeeded: f.runs.succeeded,
    failed: f.runs.failed,
    failureRate: total === 0 ? 0 : Math.round((f.runs.failed / total) * 1000) / 1000,
    avgDurationMs: f.runs.avgDurationMs,
  };
}

export function listFlows(
  seed: PowerAutomateSeed,
  args: { activeOnly?: boolean; ownerKaliId?: string; triggerContains?: string } = {},
): { count: number; flows: FlowSummary[] } {
  let out = seed.flows;
  if (args.activeOnly) out = out.filter((f) => f.state === "Started");
  if (args.ownerKaliId) out = out.filter((f) => f.ownerId === args.ownerKaliId);
  if (args.triggerContains) {
    const q = args.triggerContains.toLowerCase();
    out = out.filter((f) => f.trigger.toLowerCase().includes(q));
  }
  return { count: out.length, flows: out.map(toFlowSummary) };
}

export function getFlow(
  seed: PowerAutomateSeed,
  kaliEntityId: string,
): PowerAutomateFlow | null {
  return seed.flows.find((f) => f.kali_entity_id === kaliEntityId) ?? null;
}

export function getFlowRunHistory(
  seed: PowerAutomateSeed,
  args: { kali_entity_id: string; limit?: number; sinceDate?: string },
): {
  kali_entity_id: string;
  displayName: string;
  count: number;
  runs: { date: string; status: "success" | "failure"; durationMs: number }[];
} | null {
  const flow = getFlow(seed, args.kali_entity_id);
  if (!flow) return null;
  let runs = flow.runs.history;
  if (args.sinceDate) runs = runs.filter((r) => r.date >= args.sinceDate!);
  runs = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  const limit = Math.min(args.limit ?? 50, 1_000);
  return {
    kali_entity_id: flow.kali_entity_id,
    displayName: flow.displayName,
    count: runs.length,
    runs: runs.slice(0, limit),
  };
}

export interface AutomationOpportunity {
  /** "high_failure" | "stopped_with_recent_runs" | "no_runs_in_30_days" */
  kind: string;
  flowKaliId: string | null;
  flowName: string | null;
  rationale: string;
  evidence: Record<string, unknown>;
}

/**
 * Surface candidate automation gaps: flows with high failure rates, stopped
 * flows that recently had attempts, and flows that haven't fired in 30 days.
 * Real production pairs this with email-pattern analysis from M365 — the
 * agent cross-references on its own.
 */
export function findAutomationOpportunities(
  seed: PowerAutomateSeed,
  now: number = Date.now(),
): { count: number; opportunities: AutomationOpportunity[] } {
  const out: AutomationOpportunity[] = [];
  const cutoff30 = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);

  for (const f of seed.flows) {
    const total = f.runs.total;
    const failureRate = total === 0 ? 0 : f.runs.failed / total;
    if (failureRate >= 0.15) {
      out.push({
        kind: "high_failure",
        flowKaliId: f.kali_entity_id,
        flowName: f.displayName,
        rationale: `${Math.round(failureRate * 100)}% of recent runs failed — investigate root cause or replace.`,
        evidence: { total, succeeded: f.runs.succeeded, failed: f.runs.failed },
      });
    }
    const lastRun = f.runs.history.length > 0
      ? [...f.runs.history].sort((a, b) => b.date.localeCompare(a.date))[0].date.slice(0, 10)
      : null;
    if (f.state === "Stopped" && lastRun && lastRun >= cutoff30) {
      out.push({
        kind: "stopped_with_recent_activity",
        flowKaliId: f.kali_entity_id,
        flowName: f.displayName,
        rationale: `Flow is Stopped but ran recently (${lastRun}). Likely abandoned mid-deprecation — confirm intent.`,
        evidence: { state: f.state, lastRun },
      });
    }
    if (lastRun && lastRun < cutoff30 && f.state === "Started") {
      out.push({
        kind: "no_runs_in_30_days",
        flowKaliId: f.kali_entity_id,
        flowName: f.displayName,
        rationale: `Flow is Started but hasn't fired since ${lastRun}. Trigger may be broken.`,
        evidence: { lastRun },
      });
    }
  }
  return { count: out.length, opportunities: out };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const flowSummarySchema = z.object({
  kali_entity_id: z.string(),
  displayName: z.string(),
  description: z.string(),
  trigger: z.string(),
  state: z.enum(["Started", "Stopped"]),
  ownerId: z.string(),
  totalRuns: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  failureRate: z.number(),
  avgDurationMs: z.number(),
});

const flowListSchema = z.object({
  count: z.number().int().nonnegative(),
  flows: z.array(flowSummarySchema),
});

const opportunitySchema = z.object({
  kind: z.string(),
  flowKaliId: z.string().nullable(),
  flowName: z.string().nullable(),
  rationale: z.string(),
  evidence: z.record(z.string(), z.unknown()),
});

const makeTool = makeToolFactory<PowerAutomateSeed>("powerautomate", getPowerAutomateSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "powerautomate.listFlows",
    description:
      "List Power Automate workflows. Filter by state (activeOnly), owner kali_entity_id, or trigger substring. Each row carries success/failure counts + failure rate.",
    domain: "comms",
    input: z.object({
      activeOnly: z.boolean().optional(),
      ownerKaliId: z.string().optional(),
      triggerContains: z.string().optional(),
    }),
    output: flowListSchema,
    collectRecordIds: (out) => out.flows.map((f) => f.kali_entity_id),
    run: (seed, input) => listFlows(seed, input),
  }),

  makeTool({
    name: "powerautomate.getFlow",
    description: "Get a flow's full record (definition + run summary + history) by kali_entity_id.",
    domain: "comms",
    input: z.object({ kali_entity_id: z.string() }),
    output: powerAutomateFlowSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getFlow(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "powerautomate.getFlowRunHistory",
    description:
      "Recent run history for one flow (sorted newest first). Filter by sinceDate. Each row has status + durationMs.",
    domain: "comms",
    input: z.object({
      kali_entity_id: z.string(),
      sinceDate: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: z
      .object({
        kali_entity_id: z.string(),
        displayName: z.string(),
        count: z.number().int().nonnegative(),
        runs: z.array(powerAutomateRunSchema),
      })
      .nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getFlowRunHistory(seed, input),
  }),

  makeTool({
    name: "powerautomate.findAutomationOpportunities",
    description:
      "Surface candidate automation gaps in the existing flow inventory: high failure rates (≥15%), Stopped flows with recent activity (likely abandoned), and Started flows that haven't fired in 30 days (broken trigger). Powers the F8.4 automation-discovery wow-query when paired with m365.searchEmails patterns.",
    domain: "comms",
    input: z.object({}),
    output: z.object({
      count: z.number().int().nonnegative(),
      opportunities: z.array(opportunitySchema),
    }),
    collectRecordIds: (out) =>
      out.opportunities.filter((o) => o.flowKaliId).map((o) => o.flowKaliId!),
    run: (seed) => findAutomationOpportunities(seed),
  }),
];

export const powerautomate: Connector = {
  id: "powerautomate",
  label: "Power Automate",
  domain: "comms",
  tools,
  init: async () => {
    await getPowerAutomateSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(powerautomate);
  registered = true;
}

ensureRegistered();
