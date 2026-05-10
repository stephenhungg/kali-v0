/**
 * Tests for the QuickBooks connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  qbAccountSchema,
  qbBudgetVsActualSchema,
  qbPnLSchema,
  qbTransactionSchema,
} from "./quickbooks.schema";
import {
  getCashPosition,
  getExpensesByCategory,
  getPnLSummary,
  getProgramBudgetVsActual,
  getQuickbooksSeed,
  getRestrictedFunds,
  getRevenueByPeriod,
  getRunwayProjection,
  quickbooks,
  searchTransactions,
  __resetQuickbooksSeedForTest,
} from "./quickbooks";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { QuickbooksSeed } from "./quickbooks.schema";

let seed: QuickbooksSeed;

beforeAll(async () => {
  seed = await getQuickbooksSeed();
});

describe("quickbooks.schema", () => {
  test("medium fixture parses", () => {
    expect(seed.accounts.length).toBe(6);
    expect(seed.transactions.length).toBe(2779);
    expect(seed.budgetVsActual.length).toBe(6);
  });

  test("schemas accept rows", () => {
    expect(() => qbAccountSchema.parse(seed.accounts[0])).not.toThrow();
    expect(() => qbTransactionSchema.parse(seed.transactions[0])).not.toThrow();
    expect(() => qbPnLSchema.parse(seed.pnl)).not.toThrow();
    expect(() => qbBudgetVsActualSchema.parse(seed.budgetVsActual[0])).not.toThrow();
  });

  test("known edge cases (null classRef, missing vendorRef/memo) accepted", () => {
    expect(seed.transactions.some((t) => t.classRef === null)).toBe(true);
    expect(seed.transactions.some((t) => t.vendorRef === undefined)).toBe(true);
    expect(seed.transactions.some((t) => t.memo === undefined)).toBe(true);
  });

  test("rejects an unknown txnType", () => {
    const bad = { ...seed.transactions[0], txnType: "Wire" };
    expect(() => qbTransactionSchema.parse(bad)).toThrow();
  });
});

describe("getCashPosition", () => {
  test("sums all bank accounts", () => {
    const banks = seed.accounts.filter((a) => a.type === "Bank");
    const r = getCashPosition(seed);
    expect(r.totalCashOnHand).toBe(banks.reduce((s, a) => s + a.balance, 0));
    expect(r.accounts.length).toBe(banks.length);
    expect(r.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("does not include non-bank accounts", () => {
    const r = getCashPosition(seed);
    for (const a of r.accounts) expect(a.type).toBe("Bank");
  });
});

describe("getRestrictedFunds", () => {
  test("returns only restricted accounts and their sum", () => {
    const r = getRestrictedFunds(seed);
    expect(r.accounts.every((a) => a.name.toLowerCase().includes("restricted"))).toBe(true);
    expect(r.totalRestricted).toBe(r.accounts.reduce((s, a) => s + a.balance, 0));
  });
});

describe("getRevenueByPeriod", () => {
  test("only counts deposits in the date range", () => {
    const r = getRevenueByPeriod(seed, { startDate: "2025-01-01", endDate: "2025-12-31" });
    const expectedTotal = seed.transactions
      .filter(
        (t) =>
          t.txnType === "Deposit" &&
          t.txnDate >= "2025-01-01" &&
          t.txnDate <= "2025-12-31",
      )
      .reduce((s, t) => s + t.amount, 0);
    expect(r.total).toBeCloseTo(expectedTotal, 4);
  });

  test("byCategory rows sum to the total", () => {
    const r = getRevenueByPeriod(seed, { startDate: "2025-01-01", endDate: "2025-12-31" });
    const summed = r.byCategory.reduce((s, c) => s + c.total, 0);
    expect(summed).toBeCloseTo(r.total, 4);
  });

  test("byCategory sorted descending by total", () => {
    const r = getRevenueByPeriod(seed, { startDate: "2025-01-01", endDate: "2025-12-31" });
    for (let i = 1; i < r.byCategory.length; i++) {
      expect(r.byCategory[i].total).toBeLessThanOrEqual(r.byCategory[i - 1].total);
    }
  });
});

describe("getExpensesByCategory", () => {
  test("only counts bills, not deposits", () => {
    const r = getExpensesByCategory(seed, {
      startDate: "2024-01-01",
      endDate: "2026-12-31",
    });
    const allBills = seed.transactions.filter(
      (t) =>
        t.txnType === "Bill" &&
        t.txnDate >= "2024-01-01" &&
        t.txnDate <= "2026-12-31",
    );
    expect(r.total).toBeCloseTo(allBills.reduce((s, t) => s + t.amount, 0), 4);
  });

  test("pctOfTotal columns sum approximately to 100", () => {
    const r = getExpensesByCategory(seed, {
      startDate: "2024-01-01",
      endDate: "2026-12-31",
    });
    const sumPct = r.byCategory.reduce((s, c) => s + c.pctOfTotal, 0);
    expect(sumPct).toBeGreaterThan(99);
    expect(sumPct).toBeLessThan(101);
  });
});

describe("getRunwayProjection", () => {
  test("returns a row per requested month", () => {
    const r = getRunwayProjection(seed, { months: 12 });
    expect(r.projectedCashByMonth.length).toBe(12);
  });

  test("monthlyBurnEstimate is non-negative", () => {
    const r = getRunwayProjection(seed, { months: 6 });
    expect(r.monthlyBurnEstimate).toBeGreaterThanOrEqual(0);
  });

  test("exhaustsByMonth is set when projected cash goes negative", () => {
    const r = getRunwayProjection(seed, { months: 60 });
    if (r.cashOnHand < r.monthlyBurnEstimate * 60) {
      expect(r.exhaustsByMonth).not.toBeNull();
    }
  });

  test("cashOnHand matches getCashPosition.totalCashOnHand", () => {
    const r = getRunwayProjection(seed, { months: 1 });
    expect(r.cashOnHand).toBe(getCashPosition(seed).totalCashOnHand);
  });
});

describe("getProgramBudgetVsActual", () => {
  test("returns all programs with no filter", () => {
    const r = getProgramBudgetVsActual(seed);
    expect(r.count).toBe(seed.budgetVsActual.length);
  });

  test("filters to one program by kaliId", () => {
    const target = seed.budgetVsActual[0];
    const r = getProgramBudgetVsActual(seed, { programKaliId: target.programId });
    expect(r.count).toBe(1);
    expect(r.rows[0].programId).toBe(target.programId);
  });

  test("unknown program returns empty", () => {
    const r = getProgramBudgetVsActual(seed, { programKaliId: "prog_nope" });
    expect(r.count).toBe(0);
  });
});

describe("getPnLSummary", () => {
  test("returns the trailing-12-month P&L", () => {
    const r = getPnLSummary(seed);
    expect(r.period).toBe("trailing-12-months");
    expect(r.netIncome).toBe(r.totalRevenue - r.totalExpenses);
  });
});

describe("searchTransactions", () => {
  test("filters by txnType", () => {
    const r = searchTransactions(seed, { txnType: "Deposit", limit: 1000 });
    for (const t of r.transactions) expect(t.txnType).toBe("Deposit");
  });

  test("date range bound", () => {
    const r = searchTransactions(seed, {
      startDate: "2025-06-01",
      endDate: "2025-12-31",
      limit: 1000,
    });
    for (const t of r.transactions) {
      expect(t.txnDate >= "2025-06-01").toBe(true);
      expect(t.txnDate <= "2025-12-31").toBe(true);
    }
  });

  test("amount bounds", () => {
    const r = searchTransactions(seed, { minAmount: 1000, maxAmount: 10000, limit: 1000 });
    for (const t of r.transactions) {
      expect(t.amount).toBeGreaterThanOrEqual(1000);
      expect(t.amount).toBeLessThanOrEqual(10000);
    }
  });

  test("classRef matches program name", () => {
    const program = seed.budgetVsActual[0].programName;
    const r = searchTransactions(seed, { classRef: program, limit: 1000 });
    for (const t of r.transactions) expect(t.classRef).toBe(program);
  });

  test("vendorKaliId matches", () => {
    const t = seed.transactions.find((x) => x.vendorRef);
    if (!t) return;
    const vendor = t.vendorRef!;
    const r = searchTransactions(seed, { vendorKaliId: vendor, limit: 1000 });
    for (const x of r.transactions) expect(x.vendorRef).toBe(vendor);
  });
});

describe("Connector / registry integration", () => {
  test("quickbooks registered itself", () => {
    expect(listConnectors().some((c) => c.id === "quickbooks")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = quickbooks.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "quickbooks.getCashPosition",
        "quickbooks.getExpensesByCategory",
        "quickbooks.getPnLSummary",
        "quickbooks.getProgramBudgetVsActual",
        "quickbooks.getRestrictedFunds",
        "quickbooks.getRevenueByPeriod",
        "quickbooks.getRunwayProjection",
        "quickbooks.searchTransactions",
      ].sort(),
    );
  });

  test("listTools() includes every quickbooks tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of quickbooks.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await quickbooks.init!();
    await quickbooks.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("searchTransactions handler audits", async () => {
    const tool = quickbooks.tools.find((t) => t.name === "quickbooks.searchTransactions")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({ txnType: "Bill", limit: 5 }, ctx)) as {
      transactions: { kali_entity_id: string }[];
    };
    expect(ctx.entries[0].source).toBe("quickbooks");
    expect(ctx.entries[0].toolName).toBe("quickbooks.searchTransactions");
    expect(ctx.entries[0].recordIds).toEqual(
      out.transactions.map((t) => t.kali_entity_id),
    );
  });
});

describe("__resetQuickbooksSeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetQuickbooksSeedForTest();
    resetSeedCache();
    const fresh = await getQuickbooksSeed();
    expect(fresh.accounts.length).toBeGreaterThan(0);
  });
});
