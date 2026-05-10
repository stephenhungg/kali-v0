/**
 * Tests for the cross-source query DSL.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { getBloomerangSeed } from "../connectors/bloomerang";
import { getSalesforceSeed } from "../connectors/salesforce";
import { getZoomSeed } from "../connectors/zoom";
import { runQuery } from "./query";
import { context } from "./entity";
import { makeCapturingContext } from "../connectors/test-helpers";
import type { BloomerangSeed } from "../connectors/bloomerang.schema";
import type { SalesforceSeed } from "../connectors/salesforce.schema";
import type { ZoomSeed } from "../connectors/zoom.schema";

let bloom: BloomerangSeed;
let sf: SalesforceSeed;
let zoom: ZoomSeed;

beforeAll(async () => {
  bloom = await getBloomerangSeed();
  sf = await getSalesforceSeed();
  zoom = await getZoomSeed();
});

describe("runQuery — basic filter shapes", () => {
  test("empty filter list returns nothing", async () => {
    const r = await runQuery({ filters: [] });
    expect(r.count).toBe(0);
    expect(r.filtersApplied).toBe(0);
  });

  test("single bloomerang segment filter narrows to lapsed donors", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegment", op: "=", value: "lapsed" },
      ],
      limit: 200,
    });
    const expected = bloom.constituents.filter((c) => c.donorSegment === "lapsed").length;
    expect(r.count).toBe(expected);
    for (const id of r.entityIds) {
      const c = bloom.constituents.find((x) => x.kali_entity_id === id)!;
      expect(c.donorSegment).toBe("lapsed");
    }
  });

  test("numeric ≥ filter on lifetimeGiving", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "lifetimeGiving", op: ">=", value: 5_000 },
      ],
      limit: 500,
    });
    for (const id of r.entityIds) {
      const c = bloom.constituents.find((x) => x.kali_entity_id === id)!;
      expect(c.lifetimeGiving).toBeGreaterThanOrEqual(5_000);
    }
  });
});

describe("runQuery — virtual fields", () => {
  test("salesforce.$employerHasMatchingGifts narrows to contacts whose employer matches", async () => {
    const r = await runQuery({
      filters: [
        {
          source: "salesforce",
          path: "$employerHasMatchingGifts",
          op: "=",
          value: true,
        },
      ],
      limit: 1000,
    });
    expect(r.count).toBeGreaterThan(0);
    const accountsById = new Map(sf.accounts.map((a) => [a.Id, a]));
    for (const id of r.entityIds) {
      const contact = sf.contacts.find((c) => c.kali_entity_id === id)!;
      const acct = contact.AccountId ? accountsById.get(contact.AccountId) : null;
      expect(acct?.npsp__Matching_Gift_Account__c).toBe(true);
    }
  });

  test("zoom.$attendanceCount counts meetings per attendee", async () => {
    const r = await runQuery({
      filters: [
        { source: "zoom", path: "$attendanceCount", op: ">=", value: 2 },
      ],
      limit: 1000,
    });
    expect(r.count).toBeGreaterThan(0);
    // Spot-check: first surviving id really attended ≥2 zoom meetings
    if (r.entityIds.length > 0) {
      const id = r.entityIds[0];
      const cnt = zoom.meetings.filter((m) =>
        m.participants.some((p) => p.userId === id),
      ).length;
      expect(cnt).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("runQuery — multi-source intersection (F8.1 wow-query shape)", () => {
  test("lapsed donors AND lifetimeGiving>=$1k AND employer matches", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegment", op: "=", value: "lapsed" },
        { source: "bloomerang", path: "lifetimeGiving", op: ">=", value: 1_000 },
        {
          source: "salesforce",
          path: "$employerHasMatchingGifts",
          op: "=",
          value: true,
        },
      ],
      limit: 50,
    });
    // Count is the intersection of three independent filters.
    expect(r.filtersApplied).toBe(3);
    expect(Object.keys(r.perSourceCounts).length).toBe(3);
    for (const id of r.entityIds) {
      const bl = bloom.constituents.find((c) => c.kali_entity_id === id);
      const sfRow = sf.contacts.find((c) => c.kali_entity_id === id);
      expect(bl?.donorSegment).toBe("lapsed");
      expect(bl?.lifetimeGiving).toBeGreaterThanOrEqual(1_000);
      const acct = sfRow?.AccountId
        ? sf.accounts.find((a) => a.Id === sfRow.AccountId)
        : null;
      expect(acct?.npsp__Matching_Gift_Account__c).toBe(true);
    }
  });

  test("intersection collapses to zero when filters disagree", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegment", op: "=", value: "lapsed" },
        { source: "bloomerang", path: "donorSegment", op: "=", value: "major" },
      ],
    });
    expect(r.count).toBe(0);
  });
});

describe("runQuery — limit + counts", () => {
  test("limit caps the entityIds + profiles, count is unfiltered total", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegment", op: "=", value: "lapsed" },
      ],
      limit: 5,
    });
    expect(r.entityIds.length).toBeLessThanOrEqual(5);
    expect(r.profiles.length).toBeLessThanOrEqual(5);
    expect(r.count).toBeGreaterThanOrEqual(r.entityIds.length);
  });

  test("perSourceCounts has one entry per filter (keyed by source.path)", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegment", op: "=", value: "major" },
        { source: "salesforce", path: "npsp__Board_Member__c", op: "=", value: true },
      ],
    });
    expect(r.perSourceCounts["bloomerang.donorSegment"]).toBeGreaterThan(0);
    expect(r.perSourceCounts["salesforce.npsp__Board_Member__c"]).toBeGreaterThan(0);
  });
});

describe("ops", () => {
  test("'in' op matches any of a list", async () => {
    const r = await runQuery({
      filters: [
        {
          source: "bloomerang",
          path: "donorSegment",
          op: "in",
          value: ["lapsed", "major"],
        },
      ],
      limit: 1000,
    });
    for (const id of r.entityIds) {
      const c = bloom.constituents.find((x) => x.kali_entity_id === id)!;
      expect(["lapsed", "major"]).toContain(c.donorSegment);
    }
  });

  test("'contains' op (string substring)", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "address.city", op: "contains", value: "sacramento" },
      ],
      limit: 200,
    });
    expect(r.count).toBeGreaterThan(0);
  });

  test("'exists' op only matches when field is non-null", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "lastGiftDate", op: "exists" },
      ],
      limit: 5000,
    });
    for (const id of r.entityIds) {
      const c = bloom.constituents.find((x) => x.kali_entity_id === id);
      expect(c?.lastGiftDate).not.toBeNull();
    }
  });

  test("'!=' on a missing/typo'd field returns NO matches (was: matched everything)", async () => {
    // 'donorSegmnt' is a typo — the field doesn't exist on any constituent.
    // With the old buggy compare(): undefined !== "lapsed" → true → every
    // row matches. With the fix: undefined-on-left returns false.
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "donorSegmnt", op: "!=", value: "lapsed" },
      ],
      limit: 5000,
    });
    expect(r.count).toBe(0);
  });

  test("'in' on a missing field returns no matches", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "doesNotExist", op: "in", value: ["x"] },
      ],
      limit: 100,
    });
    expect(r.count).toBe(0);
  });

  test("'contains' with an empty string does NOT match every row", async () => {
    const r = await runQuery({
      filters: [
        { source: "bloomerang", path: "address.city", op: "contains", value: "" },
      ],
      limit: 5000,
    });
    expect(r.count).toBe(0);
  });
});

describe("Tool registration", () => {
  test("context.query is registered", () => {
    expect(context.tools.some((t) => t.name === "context.query")).toBe(true);
  });

  test("handler runs through audit ctx", async () => {
    const tool = context.tools.find((t) => t.name === "context.query")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      {
        filters: [
          { source: "bloomerang", path: "donorSegment", op: "=", value: "major" },
        ],
        limit: 3,
      },
      ctx,
    )) as { entityIds: string[]; count: number };
    expect(ctx.entries).toHaveLength(1);
    expect(ctx.entries[0].source).toBe("context");
    expect(ctx.entries[0].toolName).toBe("context.query");
    expect(ctx.entries[0].recordIds).toEqual(out.entityIds);
  });
});
