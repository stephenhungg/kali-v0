/**
 * KnowBe4 connector — cybersecurity training & awareness.
 *
 * Surfaces per-staff risk + training compliance + flagged incidents. The
 * agent cites this when a judge asks the wildcard "what about
 * cybersecurity training compliance" — pulling org posture and per-user
 * risk scores live from the seed.
 *
 * Real-OAuth path: KnowBe4 Reporting API (KMSAT API). API key auth.
 * ~1 week.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  knowBe4OrgPostureSchema,
  knowBe4SeedSchema,
  knowBe4UserResultSchema,
  type KnowBe4Seed,
  type KnowBe4UserResult,
} from "./knowbe4.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<KnowBe4Seed> | null = null;

export async function getKnowBe4Seed(size?: SeedSize): Promise<KnowBe4Seed> {
  if (!seedPromise) {
    seedPromise = loadSeed("knowbe4", knowBe4SeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetKnowBe4SeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

export function getOrgPosture(seed: KnowBe4Seed) {
  return seed.orgPosture;
}

export function getUserRiskScores(
  seed: KnowBe4Seed,
  args: {
    department?: string;
    minRiskScore?: number;
    maxTrainingCompletion?: number;
    limit?: number;
  } = {},
): { count: number; users: KnowBe4UserResult[] } {
  let out = seed.userResults;
  if (args.department) {
    const q = args.department.toLowerCase();
    out = out.filter((u) => u.department.toLowerCase() === q);
  }
  if (args.minRiskScore !== undefined) {
    out = out.filter((u) => u.riskScore >= args.minRiskScore!);
  }
  if (args.maxTrainingCompletion !== undefined) {
    out = out.filter((u) => u.trainingCompletionPercent <= args.maxTrainingCompletion!);
  }
  out = [...out].sort((a, b) => b.riskScore - a.riskScore);
  const limit = Math.min(args.limit ?? 50, 500);
  return { count: out.length, users: out.slice(0, limit) };
}

export function getUser(
  seed: KnowBe4Seed,
  kaliEntityId: string,
): KnowBe4UserResult | null {
  return seed.userResults.find((u) => u.kali_entity_id === kaliEntityId) ?? null;
}

export interface PhishingTestSummary {
  startDate: string | null;
  endDate: string | null;
  total: number;
  passed: number;
  failedClicked: number;
  failedCredentials: number;
  passRate: number;
}

export function getPhishingResults(
  seed: KnowBe4Seed,
  args: { startDate?: string; endDate?: string },
): PhishingTestSummary {
  let total = 0;
  let passed = 0;
  let failedClicked = 0;
  let failedCredentials = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const u of seed.userResults) {
    for (const t of u.phishingTests) {
      if (args.startDate && t.date < args.startDate) continue;
      if (args.endDate && t.date > args.endDate) continue;
      total++;
      if (t.result === "passed") passed++;
      else if (t.result === "failed_clicked") failedClicked++;
      else failedCredentials++;
      if (earliest === null || t.date < earliest) earliest = t.date;
      if (latest === null || t.date > latest) latest = t.date;
    }
  }
  return {
    startDate: earliest,
    endDate: latest,
    total,
    passed,
    failedClicked,
    failedCredentials,
    passRate: total === 0 ? 0 : Math.round((passed / total) * 1000) / 1000,
  };
}

export interface RecentIncident {
  kali_entity_id: string;
  userName: string;
  department: string;
  date: string;
  reason: string;
  riskScore: number;
}

export function getRecentIncidents(
  seed: KnowBe4Seed,
  args: { sinceDate?: string; limit?: number } = {},
): { count: number; incidents: RecentIncident[] } {
  const out: RecentIncident[] = [];
  for (const u of seed.userResults) {
    for (const f of u.flagged) {
      if (args.sinceDate && f.date < args.sinceDate) continue;
      out.push({
        kali_entity_id: u.kali_entity_id,
        userName: u.userName,
        department: u.department,
        date: f.date,
        reason: f.reason,
        riskScore: u.riskScore,
      });
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  const limit = Math.min(args.limit ?? 50, 500);
  return { count: out.length, incidents: out.slice(0, limit) };
}

export function getTrainingCompletion(
  seed: KnowBe4Seed,
  kaliEntityId: string,
): { kali_entity_id: string; userName: string; trainingCompletionPercent: number } | null {
  const u = getUser(seed, kaliEntityId);
  if (!u) return null;
  return {
    kali_entity_id: u.kali_entity_id,
    userName: u.userName,
    trainingCompletionPercent: u.trainingCompletionPercent,
  };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const incidentSchema = z.object({
  kali_entity_id: z.string(),
  userName: z.string(),
  department: z.string(),
  date: z.string(),
  reason: z.string(),
  riskScore: z.number(),
});

const phishingSummarySchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failedClicked: z.number().int().nonnegative(),
  failedCredentials: z.number().int().nonnegative(),
  passRate: z.number(),
});

const makeTool = makeToolFactory<KnowBe4Seed>("knowbe4", getKnowBe4Seed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "knowbe4.getOrgPosture",
    description:
      "Aggregate org-wide cybersecurity posture (overall risk score, training completion, flagged-user count, last phishing campaign date).",
    domain: "security",
    input: z.object({}),
    output: knowBe4OrgPostureSchema,
    collectRecordIds: () => [],
    run: (seed) => getOrgPosture(seed),
  }),

  makeTool({
    name: "knowbe4.getUserRiskScores",
    description:
      "Per-user risk + training summary. Filter by department, minimum risk score, or maximum training completion (i.e. find the riskiest staff or those slipping on training). Sorted by risk descending.",
    domain: "security",
    input: z.object({
      department: z.string().optional(),
      minRiskScore: z.number().min(0).max(100).optional(),
      maxTrainingCompletion: z.number().min(0).max(100).optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      users: z.array(knowBe4UserResultSchema),
    }),
    collectRecordIds: (out) => out.users.map((u) => u.kali_entity_id),
    run: (seed, input) => getUserRiskScores(seed, input),
  }),

  makeTool({
    name: "knowbe4.getUser",
    description:
      "Get a staff member's full KnowBe4 profile (risk score, training completion, phishing test history, flagged incidents) by kali_entity_id.",
    domain: "security",
    input: z.object({ kali_entity_id: z.string() }),
    output: knowBe4UserResultSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getUser(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "knowbe4.getPhishingResults",
    description:
      "Aggregate phishing test results in a date window across the org (passed / failed_clicked / failed_credentials, pass rate).",
    domain: "security",
    input: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    output: phishingSummarySchema,
    collectRecordIds: () => [],
    run: (seed, input) => getPhishingResults(seed, input),
  }),

  makeTool({
    name: "knowbe4.getRecentIncidents",
    description:
      "Flagged incidents (clicked phishing, missed training, suspicious behavior) sorted newest first.",
    domain: "security",
    input: z.object({
      sinceDate: z.string().optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      incidents: z.array(incidentSchema),
    }),
    collectRecordIds: (out) => out.incidents.map((i) => i.kali_entity_id),
    run: (seed, input) => getRecentIncidents(seed, input),
  }),

  makeTool({
    name: "knowbe4.getTrainingCompletion",
    description: "Get a staff member's training completion percent by kali_entity_id.",
    domain: "security",
    input: z.object({ kali_entity_id: z.string() }),
    output: z
      .object({
        kali_entity_id: z.string(),
        userName: z.string(),
        trainingCompletionPercent: z.number(),
      })
      .nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getTrainingCompletion(seed, input.kali_entity_id),
  }),
];

export const knowbe4: Connector = {
  id: "knowbe4",
  label: "KnowBe4",
  domain: "security",
  tools,
  init: async () => {
    await getKnowBe4Seed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(knowbe4);
  registered = true;
}

ensureRegistered();
