/**
 * Zod schemas for the Solana connector seed shape.
 *
 * The seed represents fictional historical disbursements the agent can
 * cite in queries. The "live" path (see `solana.ts::sendBatchPayoutLive`)
 * actually hits Solana devnet using @solana/web3.js when the operator
 * provides a signing key — that's the demo money moment.
 */

import { z } from "zod";

export const solanaTreasurySchema = z.object({
  walletAddress: z.string(),
  balanceUsdc: z.number(),
  balanceSol: z.number(),
  cluster: z.string(),
  explorerUrl: z.string(),
});
export type SolanaTreasury = z.infer<typeof solanaTreasurySchema>;

export const solanaTxTypeSchema = z.enum([
  "grant_disbursement",
  "vendor_payment",
  "board_stipend",
  "donor_refund",
]);
export type SolanaTxType = z.infer<typeof solanaTxTypeSchema>;

export const solanaTransactionSchema = z.object({
  signature: z.string(),
  kali_entity_id: z.string(),
  type: solanaTxTypeSchema,
  amountUsdc: z.number(),
  blockTime: z.number(),
  fromWallet: z.string(),
  toWallet: z.string(),
  recipientId: z.string(),
  reference: z.object({
    kind: z.enum(["grant", "donation", "vendor", "board"]),
    id: z.string(),
  }),
  feeLamports: z.number(),
  feeUsd: z.number(),
  status: z.literal("confirmed"),
  explorerUrl: z.string(),
});
export type SolanaTransaction = z.infer<typeof solanaTransactionSchema>;

export const solanaSeedSchema = z.object({
  treasury: solanaTreasurySchema,
  transactions: z.array(solanaTransactionSchema),
});
export type SolanaSeed = z.infer<typeof solanaSeedSchema>;
