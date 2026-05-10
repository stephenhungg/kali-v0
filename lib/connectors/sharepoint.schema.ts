/**
 * Zod schemas for the SharePoint connector seed shape.
 * Mirrors Microsoft Graph DriveItem / Site shapes loosely. Document bodies
 * are stored inline in v1 — production swaps to Graph + on-demand fetch.
 */

import { z } from "zod";

export const sharepointSiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
});
export type SharepointSite = z.infer<typeof sharepointSiteSchema>;

export const sharepointDocTypeSchema = z.enum([
  "board_minutes",
  "program_report",
  "grant_application",
  "financial_statement",
  "policy",
  "hr_record",
  "communication_plan",
  "annual_report",
]);
export type SharepointDocType = z.infer<typeof sharepointDocTypeSchema>;

export const sharepointFileSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  name: z.string(),
  type: sharepointDocTypeSchema,
  siteId: z.string(),
  createdBy: z.string().optional(),
  createdDateTime: z.string(),
  lastModifiedDateTime: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  body: z.string(),
  sharingLinks: z.array(z.string()),
  relatedGrant: z.string().optional(),
  relatedProgram: z.string().optional(),
});
export type SharepointFile = z.infer<typeof sharepointFileSchema>;

export const sharepointSeedSchema = z.object({
  sites: z.array(sharepointSiteSchema),
  files: z.array(sharepointFileSchema),
});
export type SharepointSeed = z.infer<typeof sharepointSeedSchema>;
