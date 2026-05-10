/**
 * Tests for the cross-source entity resolver + profile aggregator.
 * Runs against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { getBloomerangSeed } from "../connectors/bloomerang";
import { getSalesforceSeed } from "../connectors/salesforce";
import { getM365Seed } from "../connectors/m365";
import { getZoomSeed } from "../connectors/zoom";
import { entityProfile, resolveEntity } from "./entityResolver";
import { context } from "./entity";
import { listConnectors, listTools } from "../connectors/registry";
import { makeCapturingContext } from "../connectors/test-helpers";
import type { BloomerangSeed } from "../connectors/bloomerang.schema";
import type { SalesforceSeed } from "../connectors/salesforce.schema";
import type { M365Seed } from "../connectors/m365.schema";
import type { ZoomSeed } from "../connectors/zoom.schema";

let bloom: BloomerangSeed;
let sf: SalesforceSeed;
let m365: M365Seed;
let zoom: ZoomSeed;

beforeAll(async () => {
  bloom = await getBloomerangSeed();
  sf = await getSalesforceSeed();
  m365 = await getM365Seed();
  zoom = await getZoomSeed();
});

describe("resolveEntity — empty + degenerate inputs", () => {
  test("returns nothing when no fields provided", async () => {
    const r = await resolveEntity({});
    expect(r.count).toBe(0);
    expect(r.hits).toHaveLength(0);
  });
});

describe("resolveEntity — email match", () => {
  test("finds a bloomerang constituent by exact email (confidence 100)", async () => {
    const target = bloom.constituents.find((c) => c.primaryEmail.value)!;
    const r = await resolveEntity({ email: target.primaryEmail.value });
    expect(r.count).toBeGreaterThan(0);
    const top = r.hits[0];
    expect(top.kali_entity_id).toBe(target.kali_entity_id);
    expect(top.confidence).toBe(100);
    expect(top.matchedOn).toBe("email");
  });

  test("email match is case-insensitive", async () => {
    const target = bloom.constituents.find((c) => c.primaryEmail.value)!;
    const r = await resolveEntity({ email: target.primaryEmail.value.toUpperCase() });
    expect(r.hits[0].kali_entity_id).toBe(target.kali_entity_id);
  });

  test("M365 staff resolves by userPrincipalName", async () => {
    const staff = m365.users[0];
    const r = await resolveEntity({ email: staff.userPrincipalName });
    expect(r.hits.some((h) => h.kali_entity_id === staff.kali_entity_id)).toBe(true);
  });
});

describe("resolveEntity — name match", () => {
  test("exact name yields confidence 80", async () => {
    const target = bloom.constituents[0];
    const fullName = `${target.firstName} ${target.lastName}`;
    const r = await resolveEntity({ name: fullName });
    const hit = r.hits.find((h) => h.kali_entity_id === target.kali_entity_id);
    expect(hit).toBeDefined();
    expect(hit!.confidence).toBeGreaterThanOrEqual(80);
  });

  test("name substring yields confidence 40", async () => {
    const target = bloom.constituents[0];
    const r = await resolveEntity({ name: target.lastName });
    const hit = r.hits.find((h) => h.kali_entity_id === target.kali_entity_id);
    expect(hit).toBeDefined();
    expect(hit!.confidence).toBeGreaterThanOrEqual(40);
  });

  test("hits sorted by confidence descending", async () => {
    const r = await resolveEntity({ name: "Jane" });
    for (let i = 1; i < r.hits.length; i++) {
      expect(r.hits[i].confidence).toBeLessThanOrEqual(r.hits[i - 1].confidence);
    }
  });

  test("limit is enforced + hard-capped at 50", async () => {
    const r = await resolveEntity({ name: "a", limit: 9999 });
    expect(r.hits.length).toBeLessThanOrEqual(50);
  });
});

describe("resolveEntity — phone match", () => {
  test("normalised phone matches across formats", async () => {
    const target = bloom.constituents.find((c) => c.primaryPhone)!;
    const phone = target.primaryPhone!.value;
    const digits = phone.replace(/[^\d]/g, "");
    const r = await resolveEntity({ phone: `+1-${digits}` });
    expect(r.hits.some((h) => h.kali_entity_id === target.kali_entity_id)).toBe(true);
  });
});

describe("resolveEntity — same person across sources", () => {
  test("when a constituent appears in both bloomerang and salesforce, both rows merge to the higher-confidence one", async () => {
    const target = bloom.constituents.find(
      (c) =>
        c.primaryEmail.value &&
        sf.contacts.some(
          (sfc) =>
            sfc.kali_entity_id === c.kali_entity_id && sfc.Email === c.primaryEmail.value,
        ),
    );
    if (!target) return;
    const r = await resolveEntity({ email: target.primaryEmail.value });
    const matches = r.hits.filter((h) => h.kali_entity_id === target.kali_entity_id);
    expect(matches.length).toBe(1);
    expect(matches[0].confidence).toBe(100);
  });
});

describe("entityProfile", () => {
  test("returns null for an entity present in no source", async () => {
    expect(await entityProfile("ppl_doesnotexist")).toBeNull();
  });

  test("populates bloomerang section for a donor", async () => {
    const target = bloom.constituents[0];
    const r = await entityProfile(target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.presentIn).toContain("bloomerang");
    expect(r!.bloomerang).not.toBeNull();
    expect(r!.bloomerang!.segment).toBe(target.donorSegment);
  });

  test("populates m365 section for a staff member", async () => {
    const staff = m365.users[0];
    const r = await entityProfile(staff.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.presentIn).toContain("m365");
    expect(r!.m365!.department).toBe(staff.department);
  });

  test("populates zoom section when the entity attended meetings", async () => {
    const attendee = zoom.meetings.flatMap((m) => m.participants).find(Boolean)!;
    const r = await entityProfile(attendee.userId);
    if (!r) return; // attendee may not exist as a kali entity in seed
    expect(r.zoom).not.toBeNull();
    expect(r.zoom!.meetingCount).toBeGreaterThan(0);
  });

  test("cross-source entity has multiple presentIn sources", async () => {
    // Find someone who's a donor (bloomerang) AND a salesforce contact.
    const target = bloom.constituents.find((c) =>
      sf.contacts.some((sfc) => sfc.kali_entity_id === c.kali_entity_id),
    )!;
    const r = await entityProfile(target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.presentIn.length).toBeGreaterThanOrEqual(2);
    expect(r!.bloomerang).not.toBeNull();
    expect(r!.salesforce).not.toBeNull();
  });
});

describe("Connector / registry integration", () => {
  test("context registered itself", () => {
    expect(listConnectors().some((c) => c.id === "context")).toBe(true);
  });

  test("exposes the five context tools", () => {
    const names = context.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "context.entityProfile",
      "context.query",
      "context.rebuildIndex",
      "context.resolveEntity",
      "context.semanticSearch",
    ]);
  });

  test("listTools() includes the context tools", () => {
    const all = listTools().map((t) => t.name);
    expect(all).toContain("context.resolveEntity");
    expect(all).toContain("context.entityProfile");
  });
});

describe("Tool handlers (audit)", () => {
  test("resolveEntity handler audits with source=context", async () => {
    const tool = context.tools.find((t) => t.name === "context.resolveEntity")!;
    const ctx = makeCapturingContext();
    const target = bloom.constituents.find((c) => c.primaryEmail.value)!;
    const out = (await tool.handler(
      { email: target.primaryEmail.value },
      ctx,
    )) as { hits: { kali_entity_id: string }[] };
    expect(ctx.entries).toHaveLength(1);
    expect(ctx.entries[0].source).toBe("context");
    expect(ctx.entries[0].toolName).toBe("context.resolveEntity");
    expect(ctx.entries[0].recordIds).toEqual(out.hits.map((h) => h.kali_entity_id));
  });

  test("entityProfile handler audits with source=context", async () => {
    const tool = context.tools.find((t) => t.name === "context.entityProfile")!;
    const ctx = makeCapturingContext();
    const target = bloom.constituents[0];
    await tool.handler({ kali_entity_id: target.kali_entity_id }, ctx);
    expect(ctx.entries[0].source).toBe("context");
    expect(ctx.entries[0].toolName).toBe("context.entityProfile");
    expect(ctx.entries[0].recordIds).toEqual([target.kali_entity_id]);
  });
});
