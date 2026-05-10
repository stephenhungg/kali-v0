/**
 * Instrumentl connector — grant sourcing & tracking.
 *
 * Powers grant operations queries: pipeline state, upcoming deadlines, fit
 * scores, funder relationships. Cross-references to Salesforce contacts
 * (via funderId → org → board members / major donors with ties to that
 * funder) drive the F8.2 grant-ops wow-query.
 *
 * Real-OAuth path: limited public API; production requires a partnership
 * integration with Instrumentl. Backup: web scraping with permission.
 * ~3 weeks negotiation + integration.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  funderSchema,
  grantSchema,
  grantStatusSchema,
  instrumentlSeedSchema,
  type Funder,
  type Grant,
  type GrantStatus,
  type InstrumentlSeed,
} from "./instrumentl.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<InstrumentlSeed> | null = null;

export async function getInstrumentlSeed(size?: SeedSize): Promise<InstrumentlSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("instrumentl", instrumentlSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetInstrumentlSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

const TRACKED_STATUSES: GrantStatus[] = [
  "in_progress",
  "submitted",
  "awarded",
  "active",
  "reporting",
];

export interface SearchGrantsArgs {
  status?: GrantStatus;
  funderKaliId?: string;
  programKaliId?: string;
  minFitScore?: number;
  minRequestedAmount?: number;
  fundingFocus?: string;
  limit?: number;
}

export function searchGrants(
  seed: InstrumentlSeed,
  args: SearchGrantsArgs,
): { count: number; grants: Grant[] } {
  const limit = Math.min(args.limit ?? 30, 200);
  const out: Grant[] = [];
  for (const g of seed.grants) {
    if (args.status && g.status !== args.status) continue;
    if (args.funderKaliId && g.funderId !== args.funderKaliId) continue;
    if (
      args.programKaliId &&
      g.programArea !== args.programKaliId &&
      // programArea is sometimes a human-readable name vs kali id; tolerate both
      g.programArea?.toLowerCase() !== args.programKaliId.toLowerCase()
    )
      continue;
    if (args.minFitScore !== undefined && g.fitScore < args.minFitScore) continue;
    if (args.minRequestedAmount !== undefined && g.requestedAmount < args.minRequestedAmount)
      continue;
    if (args.fundingFocus) {
      const focus = args.fundingFocus.toLowerCase();
      if (!g.fundingFocus.some((f) => f.toLowerCase().includes(focus))) continue;
    }
    out.push(g);
  }
  return { count: out.length, grants: out.slice(0, limit) };
}

export function getGrant(seed: InstrumentlSeed, kaliEntityId: string): Grant | null {
  return seed.grants.find((g) => g.kali_entity_id === kaliEntityId) ?? null;
}

export function getTrackedGrants(
  seed: InstrumentlSeed,
  args: { limit?: number } = {},
): { count: number; grants: Grant[] } {
  const tracked = seed.grants.filter((g) => TRACKED_STATUSES.includes(g.status));
  const limit = Math.min(args.limit ?? 100, 500);
  return { count: tracked.length, grants: tracked.slice(0, limit) };
}

export interface DeadlineRow {
  kali_entity_id: string;
  title: string;
  funderName: string;
  funderId: string;
  status: GrantStatus;
  deadline: string;
  daysUntilDeadline: number;
  fitScore: number;
  requestedAmount: number;
  programArea: string | null;
}

export function getDeadlinesInRange(
  seed: InstrumentlSeed,
  args: { days: number; limit?: number },
  now: number = Date.now(),
): { count: number; deadlines: DeadlineRow[] } {
  const today = new Date(now).toISOString().slice(0, 10);
  const cutoff = new Date(now + args.days * 86_400_000).toISOString().slice(0, 10);
  const out: DeadlineRow[] = [];
  for (const g of seed.grants) {
    if (g.deadline < today || g.deadline > cutoff) continue;
    out.push({
      kali_entity_id: g.kali_entity_id,
      title: g.title,
      funderName: g.funderName,
      funderId: g.funderId,
      status: g.status,
      deadline: g.deadline,
      daysUntilDeadline: Math.round(
        (Date.parse(g.deadline) - now) / 86_400_000,
      ),
      fitScore: g.fitScore,
      requestedAmount: g.requestedAmount,
      programArea: g.programArea ?? null,
    });
  }
  out.sort((a, b) => a.deadline.localeCompare(b.deadline));
  const limit = Math.min(args.limit ?? 50, 200);
  return { count: out.length, deadlines: out.slice(0, limit) };
}

export function getFunderProfile(
  seed: InstrumentlSeed,
  funderKaliId: string,
): Funder | null {
  return seed.funders.find((f) => f.funderId === funderKaliId) ?? null;
}

export function getMatchScore(
  seed: InstrumentlSeed,
  grantKaliId: string,
): { kali_entity_id: string; title: string; fitScore: number; fundingFocus: string[] } | null {
  const g = getGrant(seed, grantKaliId);
  if (!g) return null;
  return {
    kali_entity_id: g.kali_entity_id,
    title: g.title,
    fitScore: g.fitScore,
    fundingFocus: g.fundingFocus,
  };
}

export function searchFunders(
  seed: InstrumentlSeed,
  args: { type?: string; fundingFocus?: string; limit?: number },
): { count: number; funders: Funder[] } {
  const limit = Math.min(args.limit ?? 30, 200);
  let out = seed.funders;
  if (args.type) out = out.filter((f) => f.type.toLowerCase() === args.type!.toLowerCase());
  if (args.fundingFocus) {
    const focus = args.fundingFocus.toLowerCase();
    out = out.filter((f) => f.fundingFocus.some((x) => x.toLowerCase().includes(focus)));
  }
  return { count: out.length, funders: out.slice(0, limit) };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const deadlineRowSchema = z.object({
  kali_entity_id: z.string(),
  title: z.string(),
  funderName: z.string(),
  funderId: z.string(),
  status: grantStatusSchema,
  deadline: z.string(),
  daysUntilDeadline: z.number().int(),
  fitScore: z.number(),
  requestedAmount: z.number(),
  programArea: z.string().nullable(),
});

const matchScoreSchema = z.object({
  kali_entity_id: z.string(),
  title: z.string(),
  fitScore: z.number(),
  fundingFocus: z.array(z.string()),
});

const makeTool = makeToolFactory<InstrumentlSeed>("instrumentl", getInstrumentlSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "instrumentl.searchGrants",
    description:
      "Search grants. Filter by status, funder (kali_entity_id), program (kali_entity_id or program-area name), minimum fit score, minimum requested amount, and funding-focus substring. Returns full grant records with funder + program references.",
    domain: "grants",
    input: z.object({
      status: grantStatusSchema.optional(),
      funderKaliId: z.string().optional(),
      programKaliId: z.string().optional(),
      minFitScore: z.number().min(0).max(100).optional(),
      minRequestedAmount: z.number().nonnegative().optional(),
      fundingFocus: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      grants: z.array(grantSchema),
    }),
    collectRecordIds: (out) => out.grants.map((g) => g.kali_entity_id),
    run: (seed, input) => searchGrants(seed, input),
  }),

  makeTool({
    name: "instrumentl.getGrant",
    description: "Get a grant's full record by kali_entity_id (funder, amounts, status, deadlines, fit score, related documents).",
    domain: "grants",
    input: z.object({ kali_entity_id: z.string() }),
    output: grantSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getGrant(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "instrumentl.getTrackedGrants",
    description:
      "All grants in our active pipeline (status in {in_progress, submitted, awarded, active, reporting}). Use this to scope 'what's open right now'.",
    domain: "grants",
    input: z.object({ limit: z.number().int().positive().max(500).optional() }),
    output: z.object({
      count: z.number().int().nonnegative(),
      grants: z.array(grantSchema),
    }),
    collectRecordIds: (out) => out.grants.map((g) => g.kali_entity_id),
    run: (seed, input) => getTrackedGrants(seed, input),
  }),

  makeTool({
    name: "instrumentl.getDeadlinesInRange",
    description:
      "Grants with deadlines in the next N days (sorted ascending). Each row includes daysUntilDeadline + fit score + requested amount + funder reference. Powers the F8.2 grant-ops wow-query.",
    domain: "grants",
    input: z.object({
      days: z.number().int().positive().max(3650),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      deadlines: z.array(deadlineRowSchema),
    }),
    collectRecordIds: (out) => out.deadlines.map((d) => d.kali_entity_id),
    run: (seed, input) => getDeadlinesInRange(seed, input),
  }),

  makeTool({
    name: "instrumentl.getFunderProfile",
    description:
      "Get a funder's profile (type, funding focus, total annual giving estimate, typical grant size) by funder kali_entity_id.",
    domain: "grants",
    input: z.object({ funderKaliId: z.string() }),
    output: funderSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.funderId] : []),
    run: (seed, input) => getFunderProfile(seed, input.funderKaliId),
  }),

  makeTool({
    name: "instrumentl.getMatchScore",
    description:
      "Instrumentl's fit score (0–100) for a given grant kali_entity_id, plus the funder's funding focus. Use to rank grants in priority order.",
    domain: "grants",
    input: z.object({ kali_entity_id: z.string() }),
    output: matchScoreSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getMatchScore(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "instrumentl.searchFunders",
    description:
      "Search funders by type (foundation | government | …) and funding-focus substring (youth | health | workforce | food security | housing | education | arts | environment).",
    domain: "grants",
    input: z.object({
      type: z.string().optional(),
      fundingFocus: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      funders: z.array(funderSchema),
    }),
    collectRecordIds: (out) => out.funders.map((f) => f.funderId),
    run: (seed, input) => searchFunders(seed, input),
  }),
];

export const instrumentl: Connector = {
  id: "instrumentl",
  label: "Instrumentl",
  domain: "grants",
  tools,
  init: async () => {
    await getInstrumentlSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(instrumentl);
  registered = true;
}

ensureRegistered();
