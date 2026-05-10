/**
 * QuickBooks Online connector — finance + accounting.
 *
 * Powers the F8.3 finance ↔ programs cross-check wow-query: cash position,
 * runway, P&L, program budget variance, restricted funds, expense category
 * breakdown.
 *
 * Real-OAuth path: Intuit OAuth 2.0 → QuickBooks Online API v3. Standard
 * and well-documented. ~2 weeks to production-ready.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  qbAccountSchema,
  qbBudgetVsActualSchema,
  qbPnLSchema,
  qbTransactionSchema,
  qbTransactionTypeSchema,
  quickbooksSeedSchema,
  type QBAccount,
  type QBBudgetVsActual,
  type QBPnL,
  type QBTransaction,
  type QBTransactionType,
  type QuickbooksSeed,
} from "./quickbooks.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<QuickbooksSeed> | null = null;

export async function getQuickbooksSeed(size?: SeedSize): Promise<QuickbooksSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("quickbooks", quickbooksSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetQuickbooksSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

export interface CashPosition {
  totalCashOnHand: number;
  accounts: { id: string; name: string; type: string; balance: number }[];
  asOf: string;
}

export function getCashPosition(
  seed: QuickbooksSeed,
  now: number = Date.now(),
): CashPosition {
  const banks = seed.accounts.filter((a) => a.type === "Bank");
  return {
    totalCashOnHand: banks.reduce((s, a) => s + a.balance, 0),
    accounts: banks,
    asOf: new Date(now).toISOString().slice(0, 10),
  };
}

export interface RestrictedFundsResult {
  totalRestricted: number;
  accounts: QBAccount[];
}

export function getRestrictedFunds(seed: QuickbooksSeed): RestrictedFundsResult {
  const restricted = seed.accounts.filter((a) =>
    a.name.toLowerCase().includes("restricted"),
  );
  return {
    totalRestricted: restricted.reduce((s, a) => s + a.balance, 0),
    accounts: restricted,
  };
}

export interface RevenueByPeriod {
  startDate: string;
  endDate: string;
  total: number;
  byCategory: { category: string; total: number; count: number }[];
}

export function getRevenueByPeriod(
  seed: QuickbooksSeed,
  args: { startDate: string; endDate: string },
): RevenueByPeriod {
  const matching = seed.transactions.filter(
    (t) =>
      t.txnType === "Deposit" &&
      t.txnDate >= args.startDate &&
      t.txnDate <= args.endDate,
  );
  const byCat = new Map<string, { total: number; count: number }>();
  for (const t of matching) {
    const e = byCat.get(t.category) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    byCat.set(t.category, e);
  }
  return {
    startDate: args.startDate,
    endDate: args.endDate,
    total: matching.reduce((s, t) => s + t.amount, 0),
    byCategory: Array.from(byCat.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}

export interface ExpensesByCategoryResult {
  startDate: string;
  endDate: string;
  total: number;
  byCategory: { category: string; total: number; count: number; pctOfTotal: number }[];
}

export function getExpensesByCategory(
  seed: QuickbooksSeed,
  args: { startDate: string; endDate: string },
): ExpensesByCategoryResult {
  const matching = seed.transactions.filter(
    (t) =>
      t.txnType === "Bill" &&
      t.txnDate >= args.startDate &&
      t.txnDate <= args.endDate,
  );
  const total = matching.reduce((s, t) => s + t.amount, 0);
  const byCat = new Map<string, { total: number; count: number }>();
  for (const t of matching) {
    const e = byCat.get(t.category) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    byCat.set(t.category, e);
  }
  return {
    startDate: args.startDate,
    endDate: args.endDate,
    total,
    byCategory: Array.from(byCat.entries())
      .map(([category, v]) => ({
        category,
        total: v.total,
        count: v.count,
        pctOfTotal: total === 0 ? 0 : Math.round((v.total / total) * 1000) / 10,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

export interface RunwayProjection {
  months: number;
  cashOnHand: number;
  monthlyBurnEstimate: number;
  projectedCashByMonth: { month: string; cash: number }[];
  exhaustsByMonth: string | null;
}

/**
 * Forward-projects cash assuming the trailing-N-month average burn rate
 * holds. Doesn't model lumpy grants, restricted funds, or seasonal revenue.
 */
export function getRunwayProjection(
  seed: QuickbooksSeed,
  args: { months: number; trailingMonths?: number },
  now: number = Date.now(),
): RunwayProjection {
  const trailing = args.trailingMonths ?? 6;
  const cutoff = new Date(now - trailing * 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recentBills = seed.transactions.filter(
    (t) => t.txnType === "Bill" && t.txnDate >= cutoff,
  );
  const totalBills = recentBills.reduce((s, t) => s + t.amount, 0);
  const monthlyBurn = totalBills / trailing;
  const cash = getCashPosition(seed, now).totalCashOnHand;

  const projected: RunwayProjection["projectedCashByMonth"] = [];
  let runningCash = cash;
  let exhaustsByMonth: string | null = null;
  for (let m = 1; m <= args.months; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);
    runningCash -= monthlyBurn;
    projected.push({ month: d.toISOString().slice(0, 7), cash: Math.round(runningCash) });
    if (runningCash < 0 && exhaustsByMonth === null) {
      exhaustsByMonth = d.toISOString().slice(0, 7);
    }
  }
  return {
    months: args.months,
    cashOnHand: cash,
    monthlyBurnEstimate: Math.round(monthlyBurn),
    projectedCashByMonth: projected,
    exhaustsByMonth,
  };
}

export function getProgramBudgetVsActual(
  seed: QuickbooksSeed,
  args: { programKaliId?: string } = {},
): { count: number; rows: QBBudgetVsActual[] } {
  if (args.programKaliId) {
    const row = seed.budgetVsActual.find((b) => b.programId === args.programKaliId);
    return { count: row ? 1 : 0, rows: row ? [row] : [] };
  }
  return { count: seed.budgetVsActual.length, rows: seed.budgetVsActual };
}

export function getPnLSummary(seed: QuickbooksSeed): QBPnL {
  return seed.pnl;
}

export interface SearchTransactionsArgs {
  txnType?: QBTransactionType;
  startDate?: string;
  endDate?: string;
  category?: string;
  classRef?: string;
  minAmount?: number;
  maxAmount?: number;
  vendorKaliId?: string;
  limit?: number;
}

export function searchTransactions(
  seed: QuickbooksSeed,
  args: SearchTransactionsArgs,
): { count: number; total: number; transactions: QBTransaction[] } {
  const limit = Math.min(args.limit ?? 100, 1_000);
  let txs: QBTransaction[] = seed.transactions;
  if (args.txnType) txs = txs.filter((t) => t.txnType === args.txnType);
  if (args.startDate) txs = txs.filter((t) => t.txnDate >= args.startDate!);
  if (args.endDate) txs = txs.filter((t) => t.txnDate <= args.endDate!);
  if (args.category) txs = txs.filter((t) => t.category === args.category);
  if (args.classRef) txs = txs.filter((t) => t.classRef === args.classRef);
  if (args.minAmount !== undefined) txs = txs.filter((t) => t.amount >= args.minAmount!);
  if (args.maxAmount !== undefined) txs = txs.filter((t) => t.amount <= args.maxAmount!);
  if (args.vendorKaliId) txs = txs.filter((t) => t.vendorRef === args.vendorKaliId);
  return {
    count: txs.length,
    total: txs.reduce((s, t) => s + t.amount, 0),
    transactions: txs.slice(0, limit),
  };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const cashPositionSchema = z.object({
  totalCashOnHand: z.number(),
  accounts: z.array(qbAccountSchema),
  asOf: z.string(),
});

const restrictedSchema = z.object({
  totalRestricted: z.number(),
  accounts: z.array(qbAccountSchema),
});

const revenueSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  total: z.number(),
  byCategory: z.array(
    z.object({
      category: z.string(),
      total: z.number(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

const expensesSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  total: z.number(),
  byCategory: z.array(
    z.object({
      category: z.string(),
      total: z.number(),
      count: z.number().int().nonnegative(),
      pctOfTotal: z.number(),
    }),
  ),
});

const runwaySchema = z.object({
  months: z.number(),
  cashOnHand: z.number(),
  monthlyBurnEstimate: z.number(),
  projectedCashByMonth: z.array(
    z.object({ month: z.string(), cash: z.number() }),
  ),
  exhaustsByMonth: z.string().nullable(),
});

const budgetListSchema = z.object({
  count: z.number().int().nonnegative(),
  rows: z.array(qbBudgetVsActualSchema),
});

const txListSchema = z.object({
  count: z.number().int().nonnegative(),
  total: z.number(),
  transactions: z.array(qbTransactionSchema),
});

const makeTool = makeToolFactory<QuickbooksSeed>("quickbooks", getQuickbooksSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "quickbooks.getCashPosition",
    description:
      "Get current cash on hand across all bank accounts. Returns total + per-account breakdown.",
    domain: "finance",
    input: z.object({}),
    output: cashPositionSchema,
    collectRecordIds: () => [],
    run: (seed) => getCashPosition(seed),
  }),

  makeTool({
    name: "quickbooks.getRestrictedFunds",
    description:
      "Donor-restricted fund balances (accounts whose names contain 'Restricted').",
    domain: "finance",
    input: z.object({}),
    output: restrictedSchema,
    collectRecordIds: () => [],
    run: (seed) => getRestrictedFunds(seed),
  }),

  makeTool({
    name: "quickbooks.getRevenueByPeriod",
    description:
      "Revenue (deposits) in a date window, broken down by category. Sorted descending by total.",
    domain: "finance",
    input: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    output: revenueSchema,
    collectRecordIds: () => [],
    run: (seed, input) => getRevenueByPeriod(seed, input),
  }),

  makeTool({
    name: "quickbooks.getExpensesByCategory",
    description:
      "Expenses (bills) in a date window, grouped by category with percent of total.",
    domain: "finance",
    input: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    output: expensesSchema,
    collectRecordIds: () => [],
    run: (seed, input) => getExpensesByCategory(seed, input),
  }),

  makeTool({
    name: "quickbooks.getRunwayProjection",
    description:
      "Project cash forward N months assuming trailing-N-month average burn. Returns monthly projections + the month cash is projected to exhaust (or null).",
    domain: "finance",
    input: z.object({
      months: z.number().int().positive().max(60),
      trailingMonths: z.number().int().positive().max(24).optional(),
    }),
    output: runwaySchema,
    collectRecordIds: () => [],
    run: (seed, input) => getRunwayProjection(seed, input),
  }),

  makeTool({
    name: "quickbooks.getProgramBudgetVsActual",
    description:
      "Annual budget vs YTD actual for every program (or a specific program by kali_entity_id). Includes pctExecuted to flag overruns/underruns.",
    domain: "finance",
    input: z.object({ programKaliId: z.string().optional() }),
    output: budgetListSchema,
    collectRecordIds: (out) => out.rows.map((r) => r.programId),
    run: (seed, input) => getProgramBudgetVsActual(seed, input),
  }),

  makeTool({
    name: "quickbooks.getPnLSummary",
    description: "Trailing-12-month P&L summary (revenue, expenses, net income).",
    domain: "finance",
    input: z.object({}),
    output: qbPnLSchema,
    collectRecordIds: () => [],
    run: (seed) => getPnLSummary(seed),
  }),

  makeTool({
    name: "quickbooks.searchTransactions",
    description:
      "Search QuickBooks transactions. Filter by type (Deposit | Bill | Transfer), date range, category, classRef (program name), amount bounds, and vendor kali_entity_id.",
    domain: "finance",
    input: z.object({
      txnType: qbTransactionTypeSchema.optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      classRef: z.string().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
      vendorKaliId: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: txListSchema,
    collectRecordIds: (out) => out.transactions.map((t) => t.kali_entity_id),
    run: (seed, input) => searchTransactions(seed, input),
  }),
];

export const quickbooks: Connector = {
  id: "quickbooks",
  label: "QuickBooks",
  domain: "finance",
  tools,
  init: async () => {
    await getQuickbooksSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(quickbooks);
  registered = true;
}

ensureRegistered();
