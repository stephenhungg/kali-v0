/**
 * Tests for the SharePoint connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  sharepointFileSchema,
  sharepointSiteSchema,
} from "./sharepoint.schema";
import {
  getDocument,
  getDocumentsByTag,
  getRecentDocuments,
  getSharedWithExternalUsers,
  getSharepointSeed,
  listSites,
  searchDocuments,
  sharepoint,
  __resetSharepointSeedForTest,
} from "./sharepoint";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { SharepointSeed } from "./sharepoint.schema";

let seed: SharepointSeed;

beforeAll(async () => {
  seed = await getSharepointSeed();
});

describe("sharepoint.schema", () => {
  test("medium fixture has expected shape", () => {
    expect(seed.sites.length).toBe(5);
    expect(seed.files.length).toBe(220);
  });

  test("schemas accept individual rows", () => {
    expect(() => sharepointFileSchema.parse(seed.files[0])).not.toThrow();
    expect(() => sharepointSiteSchema.parse(seed.sites[0])).not.toThrow();
  });

  test("known edge cases (missing relatedGrant/relatedProgram) accepted", () => {
    expect(seed.files.some((f) => f.relatedGrant === undefined)).toBe(true);
    expect(seed.files.some((f) => f.relatedProgram === undefined)).toBe(true);
  });

  test("rejects an unknown doc type", () => {
    const bad = { ...seed.files[0], type: "novel" };
    expect(() => sharepointFileSchema.parse(bad)).toThrow();
  });
});

describe("searchDocuments", () => {
  test("query matches file body content (case insensitive)", () => {
    const target = seed.files[0];
    const word = target.body.split(/\s+/)[0]!.replace(/[^a-zA-Z]/g, "");
    if (!word) return;
    const r = searchDocuments(seed, { query: word.toUpperCase() });
    expect(r.count).toBeGreaterThan(0);
  });

  test("query yielding no match returns 0", () => {
    const r = searchDocuments(seed, { query: "xyzzy_nonsense_token_qqq" });
    expect(r.count).toBe(0);
  });

  test("type filter narrows to that doc type", () => {
    const r = searchDocuments(seed, { type: "board_minutes", limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const f of r.files) expect(f.type).toBe("board_minutes");
  });

  test("siteId filter narrows to that site", () => {
    const r = searchDocuments(seed, { siteId: "site_board", limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const f of r.files) expect(f.siteId).toBe("site_board");
  });

  test("tag filter narrows to docs with that tag", () => {
    const target = seed.files.find((f) => f.tags.length > 0)!;
    const tag = target.tags[0];
    const r = searchDocuments(seed, { tag, limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const f of r.files) expect(f.tags).toContain(tag);
  });

  test("snippet contains the query when matched in body", () => {
    const target = seed.files[0];
    const word = target.body.split(/\s+/)[0]!.replace(/[^a-zA-Z]/g, "");
    if (!word) return;
    const r = searchDocuments(seed, { query: word, limit: 200 });
    const hit = r.files.find((f) => f.kali_entity_id === target.kali_entity_id);
    if (hit) expect(hit.snippet.toLowerCase()).toContain(word.toLowerCase());
  });

  test("modifiedAfter/Before bound the date window", () => {
    const r = searchDocuments(seed, {
      modifiedAfter: "2025-01-01",
      modifiedBefore: "2025-12-31",
      limit: 1000,
    });
    for (const f of r.files) {
      expect(f.lastModifiedDateTime >= "2025-01-01").toBe(true);
      expect(f.lastModifiedDateTime <= "2025-12-31").toBe(true);
    }
  });

  test("programKaliId / grantKaliId narrow to docs linked to that entity", () => {
    const linked = seed.files.find((f) => f.relatedGrant)!;
    const grantId = linked.relatedGrant!;
    const r = searchDocuments(seed, { grantKaliId: grantId, limit: 200 });
    for (const f of r.files) expect(f.relatedGrant).toBe(grantId);
  });

  test("limit hard-cap (200)", () => {
    const r = searchDocuments(seed, { limit: 9999 });
    expect(r.files.length).toBeLessThanOrEqual(200);
  });
});

describe("getDocument", () => {
  test("returns full document including body", () => {
    const target = seed.files[3];
    const r = getDocument(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.body.length).toBeGreaterThan(0);
  });

  test("returns null for unknown id", () => {
    expect(getDocument(seed, "doc_nope")).toBeNull();
  });
});

describe("getRecentDocuments", () => {
  test("returns docs modified within the window relative to a fixed `now`", () => {
    const now = Date.parse("2026-05-15T00:00:00Z");
    const r = getRecentDocuments(seed, { days: 60 }, now);
    const cutoff = new Date(now - 60 * 86_400_000).toISOString().slice(0, 10);
    for (const f of r.files) expect(f.lastModifiedDateTime >= cutoff).toBe(true);
  });
});

describe("getDocumentsByTag", () => {
  test("returns only files carrying the given tag", () => {
    const target = seed.files.find((f) => f.tags.length > 0)!;
    const tag = target.tags[0];
    const r = getDocumentsByTag(seed, { tag, limit: 200 });
    for (const f of r.files) expect(f.tags).toContain(tag);
  });

  test("unknown tag yields zero", () => {
    const r = getDocumentsByTag(seed, { tag: "definitely-not-a-real-tag" });
    expect(r.count).toBe(0);
  });
});

describe("getSharedWithExternalUsers", () => {
  test("returns only files with at least one sharing link", () => {
    const r = getSharedWithExternalUsers(seed);
    expect(r.count).toBeGreaterThan(0);
    for (const f of r.files) expect(f.sharingLinks.length).toBeGreaterThan(0);
  });
});

describe("listSites", () => {
  test("returns the 5 SharePoint sites", () => {
    expect(listSites(seed).length).toBe(5);
  });
});

describe("Connector / registry integration", () => {
  test("sharepoint registered itself", () => {
    expect(listConnectors().some((c) => c.id === "sharepoint")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = sharepoint.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "sharepoint.getDocument",
        "sharepoint.getDocumentsByTag",
        "sharepoint.getRecentDocuments",
        "sharepoint.getSharedWithExternalUsers",
        "sharepoint.listSites",
        "sharepoint.searchDocuments",
      ].sort(),
    );
  });

  test("listTools() includes every sharepoint tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of sharepoint.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await sharepoint.init!();
    await sharepoint.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("searchDocuments handler audits", async () => {
    const tool = sharepoint.tools.find((t) => t.name === "sharepoint.searchDocuments")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { type: "board_minutes", limit: 5 },
      ctx,
    )) as { files: { kali_entity_id: string; type: string }[] };
    expect(out.files.length).toBeLessThanOrEqual(5);
    for (const f of out.files) expect(f.type).toBe("board_minutes");
    expect(ctx.entries[0].source).toBe("sharepoint");
    expect(ctx.entries[0].toolName).toBe("sharepoint.searchDocuments");
    expect(ctx.entries[0].recordIds).toEqual(out.files.map((f) => f.kali_entity_id));
  });
});

describe("__resetSharepointSeedForTest", () => {
  test("forces a fresh load", async () => {
    __resetSharepointSeedForTest();
    resetSeedCache();
    const fresh = await getSharepointSeed();
    expect(fresh.sites.length).toBeGreaterThan(0);
  });
});
