/**
 * Power BI connector — analytics + reporting dashboards.
 *
 * Surfaces top-level org metrics so the agent can ground claims in BI
 * dashboards (e.g. "retention rate is down 3pp QoQ per the Donor Health
 * dashboard"). Cross-tool angle: the agent chains powerbi.getKPISnapshot
 * → quickbooks.getProgramBudgetVsActual to reconcile dashboard claims
 * with the underlying ledger.
 *
 * Real-OAuth path: Power BI REST API. Workspace-level access. Embedding
 * tokens for in-Kali visualization. ~2 weeks.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  powerBIDashboardSchema,
  powerBISeedSchema,
  powerBITileSchema,
  type PowerBIDashboard,
  type PowerBISeed,
  type PowerBITile,
} from "./powerbi.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<PowerBISeed> | null = null;

export async function getPowerBISeed(size?: SeedSize): Promise<PowerBISeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("powerBI", powerBISeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetPowerBISeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

export interface DashboardSummary {
  kali_entity_id: string;
  id: string;
  displayName: string;
  embedUrl: string;
  tileCount: number;
}

export function listDashboards(seed: PowerBISeed): DashboardSummary[] {
  return seed.dashboards.map((d) => ({
    kali_entity_id: d.kali_entity_id,
    id: d.id,
    displayName: d.displayName,
    embedUrl: d.embedUrl,
    tileCount: d.tiles.length,
  }));
}

export function getDashboard(
  seed: PowerBISeed,
  args: { kali_entity_id?: string; nameContains?: string },
): PowerBIDashboard | null {
  if (args.kali_entity_id) {
    return seed.dashboards.find((d) => d.kali_entity_id === args.kali_entity_id) ?? null;
  }
  if (args.nameContains) {
    const q = args.nameContains.toLowerCase();
    return seed.dashboards.find((d) => d.displayName.toLowerCase().includes(q)) ?? null;
  }
  return null;
}

export interface KPISnapshotEntry {
  dashboardKaliId: string;
  dashboardName: string;
  tileId: string;
  title: string;
  currentValue: number;
  previousValue: number;
  trendPct: number;
}

export function getKPISnapshot(
  seed: PowerBISeed,
  args: { limit?: number } = {},
): { count: number; tiles: KPISnapshotEntry[] } {
  const tiles: KPISnapshotEntry[] = [];
  for (const d of seed.dashboards) {
    for (const t of d.tiles) {
      tiles.push({
        dashboardKaliId: d.kali_entity_id,
        dashboardName: d.displayName,
        tileId: t.tileId,
        title: t.title,
        currentValue: t.currentValue,
        previousValue: t.previousValue,
        trendPct: t.trendPct,
      });
    }
  }
  const limit = Math.min(args.limit ?? 100, 500);
  return { count: tiles.length, tiles: tiles.slice(0, limit) };
}

export function searchTiles(
  seed: PowerBISeed,
  args: { titleContains: string; limit?: number },
): { count: number; tiles: KPISnapshotEntry[] } {
  const q = args.titleContains.toLowerCase();
  const tiles: KPISnapshotEntry[] = [];
  for (const d of seed.dashboards) {
    for (const t of d.tiles) {
      if (!t.title.toLowerCase().includes(q)) continue;
      tiles.push({
        dashboardKaliId: d.kali_entity_id,
        dashboardName: d.displayName,
        tileId: t.tileId,
        title: t.title,
        currentValue: t.currentValue,
        previousValue: t.previousValue,
        trendPct: t.trendPct,
      });
    }
  }
  const limit = Math.min(args.limit ?? 50, 500);
  return { count: tiles.length, tiles: tiles.slice(0, limit) };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const dashboardSummarySchema = z.object({
  kali_entity_id: z.string(),
  id: z.string(),
  displayName: z.string(),
  embedUrl: z.string(),
  tileCount: z.number().int().nonnegative(),
});

const kpiTileSchema = z.object({
  dashboardKaliId: z.string(),
  dashboardName: z.string(),
  tileId: z.string(),
  title: z.string(),
  currentValue: z.number(),
  previousValue: z.number(),
  trendPct: z.number(),
});

const makeTool = makeToolFactory<PowerBISeed>("powerbi", getPowerBISeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "powerbi.listDashboards",
    description:
      "List configured Power BI dashboards (Donor Health, Program Impact, Fundraising Pipeline, Financial Health) with embed URLs + tile counts.",
    domain: "analytics",
    input: z.object({}),
    output: z.array(dashboardSummarySchema),
    collectRecordIds: (out) => out.map((d) => d.kali_entity_id),
    run: (seed) => listDashboards(seed),
  }),

  makeTool({
    name: "powerbi.getDashboard",
    description:
      "Get a specific dashboard with all its tiles. Look up by kali_entity_id OR by dashboard name substring (case-insensitive). Returns null if neither matches.",
    domain: "analytics",
    input: z
      .object({
        kali_entity_id: z.string().optional(),
        nameContains: z.string().optional(),
      })
      .refine((v) => v.kali_entity_id || v.nameContains, {
        message: "Provide kali_entity_id or nameContains",
      }),
    output: powerBIDashboardSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getDashboard(seed, input),
  }),

  makeTool({
    name: "powerbi.getKPISnapshot",
    description:
      "Flat list of every tile across every dashboard, with current value, previous value, and QoQ trend percent. Use as an at-a-glance org snapshot.",
    domain: "analytics",
    input: z.object({ limit: z.number().int().positive().max(500).optional() }),
    output: z.object({
      count: z.number().int().nonnegative(),
      tiles: z.array(kpiTileSchema),
    }),
    collectRecordIds: (out) => out.tiles.map((t) => t.tileId),
    run: (seed, input) => getKPISnapshot(seed, input),
  }),

  makeTool({
    name: "powerbi.searchTiles",
    description:
      "Find dashboard tiles whose title matches a substring (case-insensitive) across every dashboard. Each result carries the parent dashboard reference for further drill-in.",
    domain: "analytics",
    input: z.object({
      titleContains: z.string().min(1),
      limit: z.number().int().positive().max(500).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      tiles: z.array(kpiTileSchema),
    }),
    collectRecordIds: (out) => out.tiles.map((t) => t.tileId),
    run: (seed, input) => searchTiles(seed, input),
  }),
];

export const powerbi: Connector = {
  id: "powerbi",
  label: "Power BI",
  domain: "analytics",
  tools,
  init: async () => {
    await getPowerBISeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(powerbi);
  registered = true;
}

ensureRegistered();
