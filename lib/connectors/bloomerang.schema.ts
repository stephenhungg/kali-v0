/**
 * Zod schemas for the Bloomerang connector seed shape.
 *
 * The seed is produced by `lib/seed/project.ts::projectBloomerang`. Edge cases
 * (nullable phones, empty emails, missing employers, prospects with no gift
 * dates) come from `lib/seed/build-graph.ts` and are exercised by the medium
 * fixture — keep this schema in lockstep with both files.
 */

import { z } from "zod";

export const donorSegmentSchema = z.enum([
  "major",
  "mid",
  "grassroots",
  "lapsed",
  "prospect",
]);
export type DonorSegment = z.infer<typeof donorSegmentSchema>;

export const paymentMethodSchema = z.enum([
  "cash",
  "check",
  "credit_card",
  "ach",
  "stock",
  "crypto",
  "in_kind",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
});

export const constituentSchema = z.object({
  constituentId: z.string(),
  kali_entity_id: z.string(),
  type: z.literal("individual"),
  firstName: z.string(),
  lastName: z.string(),
  primaryEmail: z.object({ value: z.string(), type: z.string() }),
  primaryPhone: z
    .object({ value: z.string(), type: z.string() })
    .nullable(),
  address: addressSchema,
  employer: z.string().optional(),
  jobTitle: z.string().optional(),
  engagement: z.object({
    score: z.number(),
    level: z.string(),
  }),
  lifetimeGiving: z.number(),
  firstGiftDate: z.string().nullable(),
  lastGiftDate: z.string().nullable(),
  donorSegment: donorSegmentSchema,
  customFields: z.object({
    matchingGiftEligible: z.boolean(),
    preferredContactMethod: z.enum(["email", "phone"]),
  }),
});
export type Constituent = z.infer<typeof constituentSchema>;

export const transactionSchema = z.object({
  transactionId: z.string(),
  kali_entity_id: z.string(),
  constituentId: z.string(),
  amount: z.number(),
  date: z.string(),
  paymentMethod: paymentMethodSchema,
  isMatched: z.boolean(),
  matchedAmount: z.number(),
  campaignId: z.string().optional(),
  appealId: z.string().optional(),
  fundDesignation: z.string().optional(),
  acknowledged: z.boolean(),
  thankYouSentDate: z.string().nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const onlineFormSchema = z.object({
  formId: z.string(),
  name: z.string(),
  url: z.string(),
  active: z.boolean(),
  ytdRaised: z.number(),
});
export type OnlineForm = z.infer<typeof onlineFormSchema>;

export const bloomerangSeedSchema = z.object({
  constituents: z.array(constituentSchema),
  transactions: z.array(transactionSchema),
  onlineForms: z.array(onlineFormSchema),
});
export type BloomerangSeed = z.infer<typeof bloomerangSeedSchema>;
