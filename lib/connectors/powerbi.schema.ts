/**
 * Zod schemas for the Power BI connector seed shape.
 * Mirrors Power BI REST API dashboard + tile shapes loosely.
 */

import { z } from "zod";

export const powerBITileSchema = z.object({
  tileId: z.string(),
  title: z.string(),
  currentValue: z.number(),
  previousValue: z.number(),
  trendPct: z.number(),
});
export type PowerBITile = z.infer<typeof powerBITileSchema>;

export const powerBIDashboardSchema = z.object({
  id: z.string(),
  kali_entity_id: z.string(),
  displayName: z.string(),
  embedUrl: z.string(),
  tiles: z.array(powerBITileSchema),
});
export type PowerBIDashboard = z.infer<typeof powerBIDashboardSchema>;

export const powerBISeedSchema = z.object({
  dashboards: z.array(powerBIDashboardSchema),
});
export type PowerBISeed = z.infer<typeof powerBISeedSchema>;
