/**
 * x402 connector — exposes agent tools that read x402 receipts +
 * subscriptions and join against the existing Solana seed for unified
 * treasury views. The public payment endpoint lives at
 * `app/api/x402/[tenant]/route.ts`; this module is what the Kali agent
 * actually calls when reasoning ("how much did we receive via x402 this
 * hour?", "what's our recurring monthly USDC?", etc.).
 *
 * HYBRID mode: every receipt list merges (a) real receipts from
 * `x402_receipts` (memory or Postgres) with (b) seed receipts from
 * `data/seed/<size>/x402.json`. Each receipt carries `seed_flag` so the
 * audit log keeps the two streams legible.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import {
  recentDonationsInput,
  recentDonationsOutput,
  revenueSummaryInput,
  revenueSummaryOutput,
  subscriptionListInput,
  subscriptionListOutput,
  cancelRecurringInput,
  cancelRecurringOutput,
  treasuryInflowsInput,
  treasuryInflowsOutput,
  type X402Receipt,
} from "./x402.schema";
import { listReceipts, toWireReceipt } from "@/lib/x402/receipt";
import { listSubscriptions, cancelSubscription } from "@/lib/x402/recurring";
import { getSolanaSeed } from "./solana";
import { hashParams } from "./test-helpers";

const CONNECTOR_ID = "x402" as const;

/* ─── seed helper (the H in HYBRID) ──────────────────────────────────── */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MemX402Receipt } from "@/lib/db/memory";

let seedPromise: Promise<MemX402Receipt[]> | null = null;

async function loadSeedReceipts(): Promise<MemX402Receipt[]> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const size = process.env.KALI_SEED_SIZE ?? "medium";
      const seedPath = path.join(process.cwd(), "data", "seed", size, "x402.json");
      try {
        const raw = await readFile(seedPath, "utf8");
        const parsed = JSON.parse(raw) as { receipts: MemX402Receipt[] };
        return parsed.receipts ?? [];
      } catch {
        // Seed file missing is fine on a fresh checkout — the demo just
        // shows zero historical donations until something settles.
        return [];
      }
    })();
  }
  return seedPromise;
}

export function __resetX402SeedForTest(): void {
  seedPromise = null;
}

/* ─── audit wrapper ──────────────────────────────────────────────────── */

interface ToolSpec<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  description: string;
  domain: ToolDefinition["domain"];
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: { tenantId: string }) => Promise<z.infer<O>>;
  collectRecordIds?: (out: z.infer<O>) => string[];
}

function makeTool<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  spec: ToolSpec<I, O>,
): ToolDefinition<I, O> {
  return {
    name: spec.name,
    description: spec.description,
    domain: spec.domain,
    input: spec.input,
    output: spec.output,
    handler: async (input, ctx) => {
      const t0 = Date.now();
      const result = await spec.run(input, { tenantId: ctx.tenantId });
      await ctx.audit({
        source: CONNECTOR_ID,
        toolName: spec.name,
        paramsHash: hashParams(input),
        recordIds: spec.collectRecordIds ? spec.collectRecordIds(result) : [],
        durationMs: Date.now() - t0,
      });
      return result;
    },
  };
}

/* ─── tools ──────────────────────────────────────────────────────────── */

const tools: ToolDefinition[] = [
  makeTool({
    name: "x402.recentDonations",
    description:
      "Recent x402 donations for the active tenant. Hybrid: merges real receipts (settled onchain via the public pay.kalilabs.ai endpoint) with rich seed data. Optionally filter by attribution (human | autonomous | unknown). Returns counts, totals, and per-receipt detail with explorer URLs.",
    domain: "donor",
    input: recentDonationsInput,
    output: recentDonationsOutput,
    collectRecordIds: (out) => out.receipts.map((r) => r.kali_entity_id),
    run: async (input, ctx) => {
      const live = await listReceipts({
        tenantId: ctx.tenantId,
        windowDays: input.windowDays,
        attribution: input.attribution,
        limit: input.limit,
      });
      const seed = await loadSeedReceipts();
      const cutoff = Date.now() - input.windowDays * 86_400_000;
      const seedFiltered = seed
        .filter((r) => r.tenantId === ctx.tenantId)
        .filter((r) => Date.parse(r.receivedAt) >= cutoff)
        .filter((r) => !input.attribution || r.attribution === input.attribution);

      const merged = [...live, ...seedFiltered]
        .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
        .slice(0, input.limit ?? 200);

      const wire: X402Receipt[] = merged.map((r) =>
        toWireReceipt(r, ctx.tenantId),
      );
      const totalUsdc = wire.reduce((s, r) => s + r.amount_usdc, 0);
      const taxDeductibleUsdc = wire
        .filter((r) => r.tax_deductible)
        .reduce((s, r) => s + r.amount_usdc, 0);
      return {
        count: wire.length,
        totalUsdc,
        taxDeductibleUsdc,
        receipts: wire,
      };
    },
  }),

  makeTool({
    name: "x402.revenueSummary",
    description:
      "Aggregate x402 revenue by attribution class (human / autonomous / unknown) over a date range. Includes count + total USDC per bucket plus active recurring subscriptions and projected monthly recurring USDC. Use this when staff ask 'what's our agent-economy revenue?'",
    domain: "finance",
    input: revenueSummaryInput,
    output: revenueSummaryOutput,
    collectRecordIds: () => [],
    run: async (input, ctx) => {
      const startMs = input.startDate ? Date.parse(input.startDate) : 0;
      const endMs = input.endDate ? Date.parse(input.endDate) : Date.now();
      const live = await listReceipts({ tenantId: ctx.tenantId, windowDays: 365 });
      const seed = await loadSeedReceipts();
      const all = [...live, ...seed.filter((r) => r.tenantId === ctx.tenantId)].filter(
        (r) => {
          const t = Date.parse(r.receivedAt);
          return t >= startMs && t <= endMs;
        },
      );
      const init = () => ({ count: 0, totalUsdc: 0 });
      const byAttribution = {
        human: init(),
        autonomous: init(),
        unknown: init(),
      } as ReturnType<typeof revenueSummaryOutput.parse>["byAttribution"];
      let totalUsdc = 0;
      let taxDeductibleUsdc = 0;
      for (const r of all) {
        byAttribution[r.attribution].count += 1;
        byAttribution[r.attribution].totalUsdc += r.amountUsdc;
        totalUsdc += r.amountUsdc;
        if (r.taxDeductible) taxDeductibleUsdc += r.amountUsdc;
      }
      const subs = await listSubscriptions({ tenantId: ctx.tenantId, status: "active" });
      const monthly = subs.reduce(
        (s, sub) => s + (sub.period === "monthly" ? sub.amountUsdc : sub.amountUsdc * 4.345),
        0,
      );
      return {
        totalUsdc,
        taxDeductibleUsdc,
        byAttribution,
        recurringActiveCount: subs.length,
        recurringMonthlyUsdc: monthly,
      };
    },
  }),

  makeTool({
    name: "x402.recurringSubscriptions",
    description:
      "List recurring x402 subscriptions for the tenant. Each row has the payer wallet, amount, period (monthly|weekly), next charge time, and status (active|paused|canceled|failed). Optional status filter.",
    domain: "donor",
    input: subscriptionListInput,
    output: subscriptionListOutput,
    collectRecordIds: (out) => out.subscriptions.map((s) => s.id),
    run: async (input, ctx) => {
      const subs = await listSubscriptions({
        tenantId: ctx.tenantId,
        status: input.status,
      });
      return {
        count: subs.length,
        subscriptions: subs.map((s) => ({
          id: s.id,
          tenant_kali_entity_id: s.tenantId,
          payer_wallet: s.payerWallet,
          amount_usdc: s.amountUsdc,
          period: s.period,
          next_charge_at: s.nextChargeAt,
          end_date: s.endDate,
          status: s.status,
          retry_count: s.retryCount,
          last_receipt_id: s.lastReceiptId,
          memo: s.memo,
          program_designation: s.programDesignation,
          created_at: s.createdAt,
        })),
      };
    },
  }),

  makeTool({
    name: "x402.cancelRecurring",
    description:
      "Cancel a recurring x402 subscription. Use when a donor revokes consent. Idempotent — calling on a canceled subscription returns ok=true without side effects.",
    domain: "donor",
    input: cancelRecurringInput,
    output: cancelRecurringOutput,
    collectRecordIds: () => [],
    run: async (input) => cancelSubscription(input.subscriptionId),
  }),

  makeTool({
    name: "x402.treasuryInflows",
    description:
      "Unified onchain treasury inflows over the last N days — joins x402 receipts with the legacy Solana disbursement history so the agent sees ALL onchain money in one place. Returns a per-day breakdown for charting.",
    domain: "finance",
    input: treasuryInflowsInput,
    output: treasuryInflowsOutput,
    collectRecordIds: () => [],
    run: async (input, ctx) => {
      const live = await listReceipts({
        tenantId: ctx.tenantId,
        windowDays: input.windowDays,
      });
      const seed = await loadSeedReceipts();
      const cutoff = Date.now() - input.windowDays * 86_400_000;
      const x402All = [
        ...live,
        ...seed.filter((r) => r.tenantId === ctx.tenantId),
      ].filter((r) => Date.parse(r.receivedAt) >= cutoff);
      const x402Usdc = x402All.reduce((s, r) => s + r.amountUsdc, 0);

      const sol = await getSolanaSeed();
      const cutoffSec = Math.floor(cutoff / 1000);
      const solInflows = sol.transactions.filter(
        (t) => t.blockTime >= cutoffSec && t.type === "donor_refund",
      );
      const legacyUsdc = solInflows.reduce((s, t) => s + t.amountUsdc, 0);

      const byDay = new Map<string, { usdc: number; count: number }>();
      const bucket = (iso: string, amt: number) => {
        const day = iso.slice(0, 10);
        const cur = byDay.get(day) ?? { usdc: 0, count: 0 };
        cur.usdc += amt;
        cur.count += 1;
        byDay.set(day, cur);
      };
      for (const r of x402All) bucket(r.receivedAt, r.amountUsdc);
      for (const t of solInflows) {
        bucket(new Date(t.blockTime * 1000).toISOString(), t.amountUsdc);
      }

      return {
        windowDays: input.windowDays,
        x402Usdc,
        x402Count: x402All.length,
        legacySolanaUsdc: legacyUsdc,
        legacySolanaCount: solInflows.length,
        totalUsdc: x402Usdc + legacyUsdc,
        byDay: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, usdc: v.usdc, count: v.count })),
      };
    },
  }),
];

export const x402Connector: Connector = {
  id: CONNECTOR_ID,
  label: "x402 Donations",
  domain: "donor",
  tools,
  init: async () => {
    await loadSeedReceipts();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(x402Connector);
  registered = true;
}

ensureRegistered();
