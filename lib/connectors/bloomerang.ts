/**
 * Bloomerang connector — donor management & online donations.
 *
 * Reference implementation. Sets the pattern that every other connector
 * (salesforce, m365, zoom, etc.) follows:
 *
 *   1. A `*.schema.ts` file defines zod schemas for the seed shape.
 *   2. Pure query functions take a validated seed + typed args, return typed
 *      output. No I/O. Testable in isolation.
 *   3. The Connector wraps each query in a `ToolDefinition` with a zod input
 *      schema, an output schema, and an audit-logging handler.
 *   4. The connector's `init()` loads the seed via `loadSeed` and caches it.
 *   5. The module self-registers via `registerConnector(bloomerang)`.
 *
 * Real-OAuth path: Bloomerang exposes a REST API with API-key auth. The
 * production migration replaces `getSeed()` with an authenticated client and
 * the query functions adapt their inputs to Bloomerang query params. Estimated
 * effort: ~1 week.
 */

import { z } from "zod";
import type { Connector, ToolContext, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { hashParams } from "./test-helpers";
import {
  bloomerangSeedSchema,
  donorSegmentSchema,
  type BloomerangSeed,
  type Constituent,
  type DonorSegment,
  type Transaction,
} from "./bloomerang.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<BloomerangSeed> | null = null;

/**
 * Lazily loads (and caches) the bloomerang seed. The size is sticky for a
 * process: first call wins. Reset via `resetSeedCache` + `__resetForTest()`
 * if you need to reload.
 */
export async function getBloomerangSeed(size?: SeedSize): Promise<BloomerangSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("bloomerang", bloomerangSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

/** Test-only: drop the in-process promise so the next `getBloomerangSeed()` re-reads. */
export function __resetBloomerangSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries (testable, no I/O) ─────────────────────────────────── */

const SEARCH_LIMIT = 50;
const TX_LIMIT = 100;

export interface SearchDonorsArgs {
  segment?: DonorSegment;
  minLifetimeGiving?: number;
  /** Lower bound on days-since-last-gift (e.g. `90` to find lapsing donors). */
  minDaysSinceLastGift?: number;
  /** Upper bound on days-since-last-gift (e.g. `30` to find recent donors). */
  maxDaysSinceLastGift?: number;
  /** When true, only donors whose `customFields.matchingGiftEligible === true`. */
  matchingGiftEligibleOnly?: boolean;
  /** Limit on returned rows. Hard-capped at 200. */
  limit?: number;
}

export interface DonorSummary {
  kali_entity_id: string;
  name: string;
  email: string | null;
  segment: DonorSegment;
  lifetimeGiving: number;
  lastGiftDate: string | null;
  engagementLevel: string;
  matchingGiftEligible: boolean;
  employer: string | null;
}

function toDonorSummary(c: Constituent): DonorSummary {
  return {
    kali_entity_id: c.kali_entity_id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.primaryEmail.value || null,
    segment: c.donorSegment,
    lifetimeGiving: c.lifetimeGiving,
    lastGiftDate: c.lastGiftDate,
    engagementLevel: c.engagement.level,
    matchingGiftEligible: c.customFields.matchingGiftEligible,
    employer: c.employer ?? null,
  };
}

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now - t) / 86_400_000;
}

export function searchDonors(
  seed: BloomerangSeed,
  args: SearchDonorsArgs,
  now: number = Date.now(),
): { count: number; donors: DonorSummary[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const out: Constituent[] = [];
  for (const c of seed.constituents) {
    if (args.segment && c.donorSegment !== args.segment) continue;
    if (
      args.minLifetimeGiving !== undefined &&
      c.lifetimeGiving < args.minLifetimeGiving
    )
      continue;
    if (
      args.matchingGiftEligibleOnly &&
      !c.customFields.matchingGiftEligible
    )
      continue;
    const since = daysSince(c.lastGiftDate, now);
    if (args.minDaysSinceLastGift !== undefined) {
      if (since === null || since < args.minDaysSinceLastGift) continue;
    }
    if (args.maxDaysSinceLastGift !== undefined) {
      if (since === null || since > args.maxDaysSinceLastGift) continue;
    }
    out.push(c);
  }
  return { count: out.length, donors: out.slice(0, limit).map(toDonorSummary) };
}

export function getDonor(
  seed: BloomerangSeed,
  kaliEntityId: string,
): Constituent | null {
  return (
    seed.constituents.find((c) => c.kali_entity_id === kaliEntityId) ?? null
  );
}

export interface GetDonationsArgs {
  /** Filter to one donor's transactions (by their kali_entity_id). */
  donorKaliId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  matchedOnly?: boolean;
  limit?: number;
}

export interface DonationsResult {
  count: number;
  totalAmount: number;
  matchedAmount: number;
  transactions: Transaction[];
}

export function getDonations(
  seed: BloomerangSeed,
  args: GetDonationsArgs,
): DonationsResult {
  const limit = Math.min(args.limit ?? TX_LIMIT, 1_000);
  let txs: Transaction[] = seed.transactions;

  if (args.donorKaliId) {
    const constituent = seed.constituents.find(
      (c) => c.kali_entity_id === args.donorKaliId,
    );
    if (!constituent) {
      return { count: 0, totalAmount: 0, matchedAmount: 0, transactions: [] };
    }
    txs = txs.filter((t) => t.constituentId === constituent.constituentId);
  }
  if (args.startDate) txs = txs.filter((t) => t.date >= args.startDate!);
  if (args.endDate) txs = txs.filter((t) => t.date <= args.endDate!);
  if (args.minAmount !== undefined)
    txs = txs.filter((t) => t.amount >= args.minAmount!);
  if (args.maxAmount !== undefined)
    txs = txs.filter((t) => t.amount <= args.maxAmount!);
  if (args.matchedOnly) txs = txs.filter((t) => t.isMatched);

  const totalAmount = txs.reduce((s, t) => s + t.amount, 0);
  const matchedAmount = txs.reduce((s, t) => s + t.matchedAmount, 0);
  return {
    count: txs.length,
    totalAmount,
    matchedAmount,
    transactions: txs.slice(0, limit),
  };
}

export function getRecentDonations(
  seed: BloomerangSeed,
  days: number,
  now: number = Date.now(),
): DonationsResult {
  const cutoff = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  return getDonations(seed, { startDate: cutoff });
}

export function getEngagementScore(
  seed: BloomerangSeed,
  kaliEntityId: string,
): { score: number; level: string } | null {
  const c = getDonor(seed, kaliEntityId);
  return c ? { score: c.engagement.score, level: c.engagement.level } : null;
}

export function getOnlineDonationForms(seed: BloomerangSeed) {
  return seed.onlineForms;
}

/* ─── tool definitions (zod-typed surface for the agent) ──────────────── */

const searchDonorsInput = z.object({
  segment: donorSegmentSchema.optional(),
  minLifetimeGiving: z.number().nonnegative().optional(),
  minDaysSinceLastGift: z.number().nonnegative().optional(),
  maxDaysSinceLastGift: z.number().nonnegative().optional(),
  matchingGiftEligibleOnly: z.boolean().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

const donorSummaryOutput = z.object({
  kali_entity_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  segment: donorSegmentSchema,
  lifetimeGiving: z.number(),
  lastGiftDate: z.string().nullable(),
  engagementLevel: z.string(),
  matchingGiftEligible: z.boolean(),
  employer: z.string().nullable(),
});

const searchDonorsOutput = z.object({
  count: z.number().int().nonnegative(),
  donors: z.array(donorSummaryOutput),
});

const getDonorInput = z.object({ kali_entity_id: z.string() });

const getDonationsInput = z.object({
  donorKaliId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  matchedOnly: z.boolean().optional(),
  limit: z.number().int().positive().max(1_000).optional(),
});

const donationsOutput = z.object({
  count: z.number().int().nonnegative(),
  totalAmount: z.number(),
  matchedAmount: z.number(),
  transactions: z.array(z.object({}).passthrough()),
});

const getRecentDonationsInput = z.object({
  days: z.number().int().positive().max(3650),
});

const engagementInput = z.object({ kali_entity_id: z.string() });
const engagementOutput = z
  .object({ score: z.number(), level: z.string() })
  .nullable();

const onlineFormsOutput = z.array(
  z.object({
    formId: z.string(),
    name: z.string(),
    url: z.string(),
    active: z.boolean(),
    ytdRaised: z.number(),
  }),
);

/**
 * Wrap a query in a ToolDefinition: validates input via zod, executes the
 * query against the seed, validates output, audit-logs the call.
 */
function makeTool<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(spec: {
  name: string;
  description: string;
  domain: ToolDefinition["domain"];
  input: TInput;
  output: TOutput;
  collectRecordIds?: (out: z.infer<TOutput>) => string[];
  run: (
    seed: BloomerangSeed,
    input: z.infer<TInput>,
  ) => z.infer<TOutput> | Promise<z.infer<TOutput>>;
}): ToolDefinition<TInput, TOutput> {
  return {
    name: spec.name,
    description: spec.description,
    domain: spec.domain,
    input: spec.input,
    output: spec.output,
    handler: async (input, ctx: ToolContext) => {
      const t0 = Date.now();
      const seed = await getBloomerangSeed();
      const result = await spec.run(seed, input);
      const recordIds = spec.collectRecordIds ? spec.collectRecordIds(result) : [];
      await ctx.audit({
        source: "bloomerang",
        toolName: spec.name,
        paramsHash: hashParams(input),
        recordIds,
        durationMs: Date.now() - t0,
      });
      return result;
    },
  };
}

const tools: ToolDefinition[] = [
  makeTool({
    name: "bloomerang.searchDonors",
    description:
      "Search Bloomerang donors. Filter by segment (major | mid | grassroots | lapsed | prospect), minimum lifetime giving, days-since-last-gift bounds, and matching-gift eligibility. Returns donor summaries with kali_entity_id, name, email, segment, lifetime giving, last gift, engagement, employer.",
    domain: "donor",
    input: searchDonorsInput,
    output: searchDonorsOutput,
    collectRecordIds: (out) => out.donors.map((d) => d.kali_entity_id),
    run: (seed, input) => searchDonors(seed, input),
  }),

  makeTool({
    name: "bloomerang.getDonor",
    description:
      "Get a Bloomerang donor's full constituent record by kali_entity_id. Returns null if not found.",
    domain: "donor",
    input: getDonorInput,
    output: z.union([z.null(), z.object({}).passthrough()]),
    collectRecordIds: (out) => (out ? [(out as Constituent).kali_entity_id] : []),
    run: (seed, input) => getDonor(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "bloomerang.getDonations",
    description:
      "Get donation transactions, optionally filtered by donor (kali_entity_id), date range, amount bounds, and matched-only. Returns count, sums, and the transaction list.",
    domain: "donor",
    input: getDonationsInput,
    output: donationsOutput,
    collectRecordIds: (out) =>
      (out.transactions as Transaction[]).map((t) => t.kali_entity_id),
    run: (seed, input) => getDonations(seed, input),
  }),

  makeTool({
    name: "bloomerang.getRecentDonations",
    description:
      "Get all donations in the last N days. Convenience over getDonations.",
    domain: "donor",
    input: getRecentDonationsInput,
    output: donationsOutput,
    collectRecordIds: (out) =>
      (out.transactions as Transaction[]).map((t) => t.kali_entity_id),
    run: (seed, input) => getRecentDonations(seed, input.days),
  }),

  makeTool({
    name: "bloomerang.getEngagementScore",
    description:
      "Get a donor's Bloomerang engagement score and level by kali_entity_id.",
    domain: "donor",
    input: engagementInput,
    output: engagementOutput,
    collectRecordIds: () => [],
    run: (seed, input) => getEngagementScore(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "bloomerang.getOnlineDonationForms",
    description:
      "List active and inactive online donation forms with YTD raised totals.",
    domain: "donor",
    input: z.object({}),
    output: onlineFormsOutput,
    collectRecordIds: () => [],
    run: (seed) => getOnlineDonationForms(seed),
  }),
];

export const bloomerang: Connector = {
  id: "bloomerang",
  label: "Bloomerang",
  domain: "donor",
  tools,
  init: async () => {
    await getBloomerangSeed();
  },
};

// Self-register on import. Idempotency is guarded by registry.ts.
let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(bloomerang);
  registered = true;
}

ensureRegistered();
