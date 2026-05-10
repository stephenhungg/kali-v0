/**
 * Zod schemas for the x402 connector. Mirrors the wire format defined in
 * data/x402-nonprofit-donations.md §4.1 plus a few Kali-internal types
 * used by the receipt store + agent tools.
 */

import { z } from "zod";

/* ─── x402 wire types (matches the spec verbatim) ─────────────────────── */

export const x402AcceptsSchema = z.object({
  scheme: z.literal("exact"),
  network: z.string(), // e.g. "solana-devnet" | "solana-mainnet"
  asset: z.string(), // SPL mint of the payment asset (USDC)
  payTo: z.string(), // recipient wallet (tenant treasury)
  maxAmountRequired: z.string(), // base units (10^6 for USDC)
  minAmountRequired: z.string(),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z
    .object({
      $ref: z.string().optional(),
    })
    .passthrough()
    .optional(),
  extra: z
    .object({
      kali_entity_id: z.string().optional(),
      ein: z.string().optional(),
      tax_status: z.string().optional(),
      min_human_amount: z.string().optional(),
      min_autonomous_amount: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
export type X402Accepts = z.infer<typeof x402AcceptsSchema>;

export const x402ResponseSchema = z.object({
  x402Version: z.literal(1),
  accepts: z.array(x402AcceptsSchema),
  error: z.string().nullable().optional(),
});
export type X402Response = z.infer<typeof x402ResponseSchema>;

export const x402PaymentHeaderSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal("exact"),
  network: z.string(),
  payload: z.object({
    serializedTransaction: z.string(),
    /** Optional metadata. Used by Kali for attribution + memo. */
    metadata: z
      .object({
        memo: z.string().optional(),
        kali_user_id: z.string().optional(),
        delegationProof: z
          .object({
            userId: z.string(),
            walletPubkey: z.string(),
            scope: z.string(),
            expiresAt: z.number(),
            nonce: z.string(),
            signature: z.string(),
          })
          .optional(),
        program_designation: z.string().optional(),
      })
      .partial()
      .optional(),
  }),
});
export type X402PaymentHeader = z.infer<typeof x402PaymentHeaderSchema>;

/* ─── Kali receipt shape ──────────────────────────────────────────────── */

export const attributionSchema = z.enum(["human", "autonomous", "unknown"]);
export type Attribution = z.infer<typeof attributionSchema>;

export const x402ReceiptSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  tenant_kali_entity_id: z.string(),
  amount_usdc: z.number(),
  tx_signature: z.string(),
  network: z.string(),
  explorer_url: z.string(),
  received_at: z.string(),
  payer_wallet: z.string(),
  attribution: attributionSchema,
  attribution_proof: z.unknown().nullable(),
  tax_deductible: z.boolean(),
  tax_receipt_url: z.string().nullable(),
  memo: z.string().nullable(),
  program_designation: z.string().nullable(),
  subscription_id: z.string().nullable(),
  synced_to_crm: z.boolean(),
  seed_flag: z.boolean(),
});
export type X402Receipt = z.infer<typeof x402ReceiptSchema>;

/* ─── recurring subscription ──────────────────────────────────────────── */

export const x402SubscriptionSchema = z.object({
  id: z.string(),
  tenant_kali_entity_id: z.string(),
  payer_wallet: z.string(),
  amount_usdc: z.number(),
  period: z.enum(["weekly", "monthly"]),
  next_charge_at: z.string(),
  end_date: z.string().nullable(),
  status: z.enum(["active", "paused", "canceled", "failed"]),
  retry_count: z.number().int().nonnegative(),
  last_receipt_id: z.string().nullable(),
  memo: z.string().nullable(),
  program_designation: z.string().nullable(),
  created_at: z.string(),
});
export type X402Subscription = z.infer<typeof x402SubscriptionSchema>;

/* ─── tool input/output schemas ──────────────────────────────────────── */

export const recentDonationsInput = z.object({
  windowDays: z.number().int().positive().max(365).default(7),
  limit: z.number().int().positive().max(200).optional(),
  attribution: attributionSchema.optional(),
});

export const recentDonationsOutput = z.object({
  count: z.number().int().nonnegative(),
  totalUsdc: z.number(),
  taxDeductibleUsdc: z.number(),
  receipts: z.array(x402ReceiptSchema),
});

export const revenueSummaryInput = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const revenueSummaryOutput = z.object({
  totalUsdc: z.number(),
  taxDeductibleUsdc: z.number(),
  byAttribution: z.object({
    human: z.object({ count: z.number().int().nonnegative(), totalUsdc: z.number() }),
    autonomous: z.object({ count: z.number().int().nonnegative(), totalUsdc: z.number() }),
    unknown: z.object({ count: z.number().int().nonnegative(), totalUsdc: z.number() }),
  }),
  recurringActiveCount: z.number().int().nonnegative(),
  recurringMonthlyUsdc: z.number(),
});

export const subscriptionListInput = z.object({
  status: z.enum(["active", "paused", "canceled", "failed"]).optional(),
});

export const subscriptionListOutput = z.object({
  count: z.number().int().nonnegative(),
  subscriptions: z.array(x402SubscriptionSchema),
});

export const cancelRecurringInput = z.object({
  subscriptionId: z.string(),
  reason: z.string().optional(),
});

export const cancelRecurringOutput = z.object({
  ok: z.boolean(),
  status: z.enum(["active", "paused", "canceled", "failed"]),
});

export const treasuryInflowsInput = z.object({
  windowDays: z.number().int().positive().max(365).default(30),
});

export const treasuryInflowsOutput = z.object({
  windowDays: z.number(),
  x402Usdc: z.number(),
  x402Count: z.number().int().nonnegative(),
  legacySolanaUsdc: z.number(),
  legacySolanaCount: z.number().int().nonnegative(),
  totalUsdc: z.number(),
  byDay: z.array(
    z.object({
      date: z.string(),
      usdc: z.number(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
