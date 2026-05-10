/**
 * Zod schemas for the Power Automate connector seed shape.
 * Mirrors the Power Automate Management API flow + run-summary shapes.
 */

import { z } from "zod";

export const powerAutomateRunSchema = z.object({
  date: z.string(),
  status: z.enum(["success", "failure"]),
  durationMs: z.number(),
});
export type PowerAutomateRun = z.infer<typeof powerAutomateRunSchema>;

export const powerAutomateFlowSchema = z.object({
  flowId: z.string(),
  kali_entity_id: z.string(),
  displayName: z.string(),
  description: z.string(),
  trigger: z.string(),
  state: z.enum(["Started", "Stopped"]),
  createdTime: z.string(),
  runs: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    avgDurationMs: z.number().nonnegative(),
    history: z.array(powerAutomateRunSchema),
  }),
  ownerId: z.string(),
});
export type PowerAutomateFlow = z.infer<typeof powerAutomateFlowSchema>;

export const powerAutomateSeedSchema = z.object({
  flows: z.array(powerAutomateFlowSchema),
});
export type PowerAutomateSeed = z.infer<typeof powerAutomateSeedSchema>;
