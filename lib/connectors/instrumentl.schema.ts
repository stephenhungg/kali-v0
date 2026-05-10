/**
 * Zod schemas for the Instrumentl connector seed shape.
 * Real Instrumentl exposes a limited public API; production migration
 * requires a partnership integration. ~3 weeks negotiation + work.
 */

import { z } from "zod";

export const grantStatusSchema = z.enum([
  "prospect",
  "in_progress",
  "submitted",
  "awarded",
  "rejected",
  "active",
  "reporting",
  "closed",
]);
export type GrantStatus = z.infer<typeof grantStatusSchema>;

export const grantSchema = z.object({
  grantId: z.string(),
  kali_entity_id: z.string(),
  title: z.string(),
  funderName: z.string(),
  funderId: z.string(),
  amountRange: z.object({ min: z.number(), max: z.number() }),
  requestedAmount: z.number(),
  awardedAmount: z.number().nullable(),
  status: grantStatusSchema,
  deadline: z.string(),
  submittedDate: z.string().optional(),
  awardedDate: z.string().optional(),
  reportDueDate: z.string().optional(),
  fitScore: z.number(),
  fundingFocus: z.array(z.string()),
  programArea: z.string().optional(),
  notes: z.string().optional(),
  relatedDocuments: z.array(z.string()),
});
export type Grant = z.infer<typeof grantSchema>;

export const funderSchema = z.object({
  funderId: z.string(),
  name: z.string(),
  type: z.string(),
  fundingFocus: z.array(z.string()),
  totalGivingPerYearEstimate: z.number(),
  typicalGrantSize: z.number(),
});
export type Funder = z.infer<typeof funderSchema>;

export const instrumentlSeedSchema = z.object({
  grants: z.array(grantSchema),
  funders: z.array(funderSchema),
});
export type InstrumentlSeed = z.infer<typeof instrumentlSeedSchema>;
