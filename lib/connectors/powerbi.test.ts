/**
 * Tests for the Power BI connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { powerBIDashboardSchema, powerBITileSchema } from "./powerbi.schema";
import {
  getDashboard,
  getKPISnapshot,
  getPowerBISeed,
  listDashboards,
  powerbi,
  searchTiles,
  __resetPowerBISeedForTest,
} from "./powerbi";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { PowerBISeed } from "./powerbi.schema";

let seed: PowerBISeed;

beforeAll(async () => {
  seed = await getPowerBISeed();
});

describe("powerbi.schema", () => {
  test("medium fixture has 4 dashboards", () => {
    expect(seed.dashboards.length).toBe(4);
  });

  test("schemas accept rows", () => {
    expect(() => powerBIDashboardSchema.parse(seed.dashboards[0])).not.toThrow();
    expect(() => powerBITileSchema.parse(seed.dashboards[0].tiles[0])).not.toThrow();
  });

  test("rejects a tile with non-numeric currentValue", () => {
    const bad = { ...seed.dashboards[0].tiles[0], currentValue: "lots" };
    expect(() => powerBITileSchema.parse(bad)).toThrow();
  });
});

describe("listDashboards", () => {
  test("returns all dashboards with tile counts", () => {
    const r = listDashboards(seed);
    expect(r.length).toBe(4);
    for (const d of r) expect(d.tileCount).toBeGreaterThan(0);
  });
});

describe("getDashboard", () => {
  test("by kali_entity_id", () => {
    const target = seed.dashboards[1];
    const r = getDashboard(seed, { kali_entity_id: target.kali_entity_id });
    expect(r).not.toBeNull();
    expect(r!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("by name substring (case insensitive)", () => {
    const r = getDashboard(seed, { nameContains: "DONOR" });
    expect(r).not.toBeNull();
    expect(r!.displayName.toLowerCase()).toContain("donor");
  });

  test("returns null for unknown id", () => {
    expect(getDashboard(seed, { kali_entity_id: "dash_nope" })).toBeNull();
  });

  test("zod input requires at least one filter", () => {
    const tool = powerbi.tools.find((t) => t.name === "powerbi.getDashboard")!;
    expect(() => tool.input.parse({})).toThrow();
  });
});

describe("getKPISnapshot", () => {
  test("returns every tile across every dashboard", () => {
    const r = getKPISnapshot(seed, { limit: 500 });
    const expected = seed.dashboards.reduce((s, d) => s + d.tiles.length, 0);
    expect(r.count).toBe(expected);
  });

  test("each tile carries its parent dashboard reference", () => {
    const r = getKPISnapshot(seed);
    for (const t of r.tiles) {
      expect(t.dashboardKaliId).toBeTruthy();
      expect(t.dashboardName).toBeTruthy();
    }
  });

  test("limit caps the row list (count is the unfiltered total)", () => {
    const r = getKPISnapshot(seed, { limit: 3 });
    expect(r.tiles.length).toBeLessThanOrEqual(3);
    expect(r.count).toBeGreaterThan(r.tiles.length);
  });
});

describe("searchTiles", () => {
  test("matches by title substring (case insensitive)", () => {
    const r = searchTiles(seed, { titleContains: "DONOR" });
    expect(r.count).toBeGreaterThan(0);
    for (const t of r.tiles) expect(t.title.toLowerCase()).toContain("donor");
  });

  test("unknown query yields zero", () => {
    const r = searchTiles(seed, { titleContains: "definitely-not-a-real-tile-title" });
    expect(r.count).toBe(0);
  });
});

describe("Connector / registry integration", () => {
  test("powerbi registered itself", () => {
    expect(listConnectors().some((c) => c.id === "powerbi")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = powerbi.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "powerbi.getDashboard",
        "powerbi.getKPISnapshot",
        "powerbi.listDashboards",
        "powerbi.searchTiles",
      ].sort(),
    );
  });

  test("listTools() includes every powerbi tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of powerbi.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await powerbi.init!();
    await powerbi.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("listDashboards handler audits", async () => {
    const tool = powerbi.tools.find((t) => t.name === "powerbi.listDashboards")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({}, ctx)) as { kali_entity_id: string }[];
    expect(ctx.entries[0].source).toBe("powerbi");
    expect(ctx.entries[0].recordIds).toEqual(out.map((d) => d.kali_entity_id));
  });
});

describe("__resetPowerBISeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetPowerBISeedForTest();
    resetSeedCache();
    const fresh = await getPowerBISeed();
    expect(fresh.dashboards.length).toBeGreaterThan(0);
  });
});
