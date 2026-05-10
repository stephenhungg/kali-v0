/**
 * Zod schemas for the KnowBe4 connector seed shape.
 * Mirrors KMSAT API user-result + org-posture shapes.
 */

import { z } from "zod";

export const knowBe4PhishingResultSchema = z.object({
  date: z.string(),
  result: z.enum(["passed", "failed_clicked", "failed_credentials"]),
});

export const knowBe4FlaggedSchema = z.object({
  date: z.string(),
  reason: z.string(),
});

export const knowBe4UserResultSchema = z.object({
  kbUserId: z.string(),
  kali_entity_id: z.string(),
  userName: z.string(),
  email: z.string().nullable(),
  department: z.string(),
  riskScore: z.number(),
  trainingCompletionPercent: z.number(),
  phishingTests: z.array(knowBe4PhishingResultSchema),
  flagged: z.array(knowBe4FlaggedSchema),
});
export type KnowBe4UserResult = z.infer<typeof knowBe4UserResultSchema>;

export const knowBe4OrgPostureSchema = z.object({
  overallRisk: z.number(),
  overallTrainingCompletion: z.number(),
  flaggedUserCount: z.number().int().nonnegative(),
  lastPhishingCampaignDate: z.string(),
});
export type KnowBe4OrgPosture = z.infer<typeof knowBe4OrgPostureSchema>;

export const knowBe4SeedSchema = z.object({
  userResults: z.array(knowBe4UserResultSchema),
  orgPosture: knowBe4OrgPostureSchema,
});
export type KnowBe4Seed = z.infer<typeof knowBe4SeedSchema>;
