/**
 * Zod schemas for the QuickBooks Online connector seed shape.
 * Mirrors QBO API v3 shapes loosely (Account, Transaction, P&L Report).
 */

import { z } from "zod";

export const qbAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  balance: z.number(),
});
export type QBAccount = z.infer<typeof qbAccountSchema>;

export const qbTransactionTypeSchema = z.enum(["Deposit", "Bill", "Transfer"]);
export type QBTransactionType = z.infer<typeof qbTransactionTypeSchema>;

export const qbTransactionSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  txnDate: z.string(),
  txnType: qbTransactionTypeSchema,
  accountRef: z.string(),
  amount: z.number(),
  category: z.string(),
  classRef: z.string().nullable(),
  vendorRef: z.string().optional(),
  memo: z.string().optional(),
});
export type QBTransaction = z.infer<typeof qbTransactionSchema>;

export const qbPnLSchema = z.object({
  period: z.string(),
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netIncome: z.number(),
});
export type QBPnL = z.infer<typeof qbPnLSchema>;

export const qbBudgetVsActualSchema = z.object({
  programId: z.string(),
  programName: z.string(),
  budgetAnnual: z.number(),
  ytdActual: z.number(),
  pctExecuted: z.number(),
});
export type QBBudgetVsActual = z.infer<typeof qbBudgetVsActualSchema>;

export const quickbooksSeedSchema = z.object({
  accounts: z.array(qbAccountSchema),
  transactions: z.array(qbTransactionSchema),
  pnl: qbPnLSchema,
  budgetVsActual: z.array(qbBudgetVsActualSchema),
});
export type QuickbooksSeed = z.infer<typeof quickbooksSeedSchema>;
