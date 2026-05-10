/**
 * Tests for the Microsoft 365 connector against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  m365CalendarEventSchema,
  m365DistributionListSchema,
  m365MessageSchema,
  m365UserSchema,
} from "./m365.schema";
import {
  getCalendarEvents,
  getDistributionLists,
  getEmailThread,
  getLastEmailToEmail,
  getM365Seed,
  getUser,
  m365,
  searchEmails,
  searchUsers,
  __resetM365SeedForTest,
} from "./m365";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { M365Seed } from "./m365.schema";

let seed: M365Seed;

beforeAll(async () => {
  seed = await getM365Seed();
});

describe("m365.schema", () => {
  test("medium fixture parses against the seed schema", () => {
    expect(seed.users.length).toBeGreaterThan(0);
    expect(seed.messages.length).toBeGreaterThan(0);
    expect(seed.calendars.length).toBeGreaterThan(0);
    expect(seed.distributionLists.length).toBeGreaterThan(0);
  });

  test("medium fixture has the expected aggregate shape", () => {
    expect(seed.users.length).toBe(22);
    expect(seed.messages.length).toBe(3200);
    expect(seed.calendars.length).toBe(1229);
    expect(seed.distributionLists.length).toBe(5);
  });

  test("schemas accept individual sample rows", () => {
    expect(() => m365UserSchema.parse(seed.users[0])).not.toThrow();
    expect(() => m365MessageSchema.parse(seed.messages[0])).not.toThrow();
    expect(() => m365CalendarEventSchema.parse(seed.calendars[0])).not.toThrow();
    expect(() => m365DistributionListSchema.parse(seed.distributionLists[0])).not.toThrow();
  });

  test("known edge cases (null calendar location) are accepted", () => {
    expect(seed.calendars.some((c) => c.location === null)).toBe(true);
  });

  test("rejects a malformed message (numeric subject)", () => {
    const bad = { ...seed.messages[0], subject: 42 };
    expect(() => m365MessageSchema.parse(bad)).toThrow();
  });
});

describe("getUser / searchUsers", () => {
  test("getUser returns a known staff member", () => {
    const target = seed.users[0];
    const r = getUser(seed, target.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.userPrincipalName).toBe(target.userPrincipalName);
  });

  test("getUser returns null for unknown id", () => {
    expect(getUser(seed, "ppl_nope")).toBeNull();
  });

  test("searchUsers filters by department", () => {
    const dept = seed.users[0].department;
    const r = searchUsers(seed, { department: dept });
    expect(r.count).toBeGreaterThan(0);
    for (const u of r.users) expect(u.department.toLowerCase()).toBe(dept.toLowerCase());
  });

  test("searchUsers filters by jobTitleContains", () => {
    const target = seed.users.find((u) => u.jobTitle)!;
    const fragment = (target.jobTitle ?? "").slice(0, 4);
    const r = searchUsers(seed, { jobTitleContains: fragment });
    expect(r.users.some((u) => u.kali_entity_id === target.kali_entity_id)).toBe(true);
  });

  test("searchUsers filters by name substring (case insensitive)", () => {
    const target = seed.users[2];
    const r = searchUsers(seed, { nameContains: target.displayName.toUpperCase() });
    expect(r.users.some((u) => u.kali_entity_id === target.kali_entity_id)).toBe(true);
  });
});

describe("searchEmails", () => {
  test("subjectContains matches", () => {
    const target = seed.messages[0];
    const fragment = target.subject.split(" ")[0]!;
    const r = searchEmails(seed, { subjectContains: fragment });
    expect(r.count).toBeGreaterThan(0);
    for (const m of r.messages)
      expect(m.subject.toLowerCase().includes(fragment.toLowerCase())).toBe(true);
  });

  test("fromKaliId resolves to staff email and filters", () => {
    const staff = seed.users[0];
    const fromMatches = seed.messages.filter(
      (m) => m.from.emailAddress.address === staff.userPrincipalName,
    );
    if (fromMatches.length === 0) return; // medium fixture variation
    const r = searchEmails(seed, { fromKaliId: staff.kali_entity_id, limit: 1000 });
    expect(r.count).toBe(fromMatches.length);
    for (const m of r.messages)
      expect(m.from.emailAddress.address).toBe(staff.userPrincipalName);
  });

  test("fromKaliId for unknown staff returns empty (resolved email is null, no fall-through)", () => {
    const r = searchEmails(seed, { fromKaliId: "ppl_nope", limit: 1000 });
    expect(r.count).toBe(0);
  });

  test("recipientEmail filter", () => {
    const target = seed.messages.find((m) => m.toRecipients[0]?.emailAddress.address)!;
    const recipientEmail = target.toRecipients[0].emailAddress.address!;
    const r = searchEmails(seed, { recipientEmail, limit: 1000 });
    expect(r.count).toBeGreaterThan(0);
    for (const m of r.messages)
      expect(m.toRecipients.some((rec) => rec.emailAddress.address === recipientEmail)).toBe(true);
  });

  test("date range narrows results", () => {
    const r = searchEmails(seed, { startDate: "2025-06-01", endDate: "2025-12-31", limit: 5000 });
    for (const m of r.messages) {
      expect(m.receivedDateTime >= "2025-06-01").toBe(true);
      expect(m.receivedDateTime <= "2025-12-31").toBe(true);
    }
  });

  test("hasAttachments filter", () => {
    const r = searchEmails(seed, { hasAttachments: true, limit: 2000 });
    for (const m of r.messages) expect(m.hasAttachments).toBe(true);
  });

  test("limit hard-cap (1000)", () => {
    const r = searchEmails(seed, { limit: 9999 });
    expect(r.messages.length).toBeLessThanOrEqual(1_000);
  });
});

describe("getEmailThread", () => {
  test("returns messages ordered by receivedDateTime", () => {
    const someThread = seed.messages[0].conversationId;
    const r = getEmailThread(seed, someThread);
    expect(r.count).toBeGreaterThan(0);
    for (let i = 1; i < r.messages.length; i++) {
      expect(r.messages[i].receivedDateTime >= r.messages[i - 1].receivedDateTime).toBe(true);
    }
  });

  test("unknown conversationId yields empty", () => {
    const r = getEmailThread(seed, "thr_doesnotexist");
    expect(r.count).toBe(0);
    expect(r.messages).toHaveLength(0);
  });
});

describe("getLastEmailToEmail", () => {
  test("returns the most recent message to a recipient", () => {
    const target = seed.messages.find((m) => m.toRecipients[0]?.emailAddress.address)!;
    const recipient = target.toRecipients[0].emailAddress.address!;
    const r = getLastEmailToEmail(seed, recipient);
    expect(r).not.toBeNull();
    const all = seed.messages.filter((m) =>
      m.toRecipients.some((rec) => rec.emailAddress.address === recipient),
    );
    const expected = all.reduce((acc, m) =>
      m.receivedDateTime > acc.receivedDateTime ? m : acc,
    );
    expect(r!.kali_entity_id).toBe(expected.kali_entity_id);
  });

  test("returns null for unknown recipient", () => {
    expect(getLastEmailToEmail(seed, "nobody@nowhere.example")).toBeNull();
  });
});

describe("getCalendarEvents", () => {
  test("filters by ownerKaliId (staff)", () => {
    const staff = seed.users[0];
    const r = getCalendarEvents(seed, { ownerKaliId: staff.kali_entity_id, limit: 1000 });
    for (const e of r.events)
      expect(e.organizer.emailAddress.address).toBe(staff.userPrincipalName);
  });

  test("filters by date range", () => {
    const r = getCalendarEvents(seed, {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      limit: 1000,
    });
    for (const e of r.events) {
      expect(e.start.dateTime >= "2026-01-01").toBe(true);
      expect(e.start.dateTime <= "2026-12-31").toBe(true);
    }
  });

  test("subjectContains matches", () => {
    const target = seed.calendars[0];
    const r = getCalendarEvents(seed, {
      subjectContains: target.subject.toUpperCase(),
      limit: 1000,
    });
    expect(r.events.some((e) => e.kali_entity_id === target.kali_entity_id)).toBe(true);
  });

  test("ownerKaliId for unknown staff returns empty (filter requested but unresolved)", () => {
    const r = getCalendarEvents(seed, { ownerKaliId: "ppl_nope", limit: 1000 });
    expect(r.count).toBe(0);
    expect(r.events).toHaveLength(0);
  });
});

describe("getDistributionLists", () => {
  test("returns all DLs", () => {
    expect(getDistributionLists(seed).length).toBe(5);
  });
});

describe("Connector / registry integration", () => {
  test("m365 registered itself with the registry", () => {
    expect(listConnectors().some((c) => c.id === "m365")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = m365.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "m365.getCalendarEvents",
        "m365.getDistributionLists",
        "m365.getEmailThread",
        "m365.getLastEmailToEmail",
        "m365.getUser",
        "m365.searchEmails",
        "m365.searchUsers",
      ].sort(),
    );
  });

  test("listTools() includes every m365 tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of m365.tools) expect(all).toContain(t.name);
  });

  test("init is idempotent", async () => {
    await m365.init!();
    await m365.init!();
  });
});

describe("Tool handlers (audit)", () => {
  test("searchEmails handler audits the run", async () => {
    const tool = m365.tools.find((t) => t.name === "m365.searchEmails")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { hasAttachments: true, limit: 5 },
      ctx,
    )) as { messages: { kali_entity_id: string; hasAttachments: boolean }[] };
    expect(out.messages.length).toBeLessThanOrEqual(5);
    expect(ctx.entries[0].source).toBe("m365");
    expect(ctx.entries[0].toolName).toBe("m365.searchEmails");
    expect(ctx.entries[0].recordIds).toEqual(out.messages.map((m) => m.kali_entity_id));
  });

  test("invalid input rejected by zod", () => {
    const tool = m365.tools.find((t) => t.name === "m365.searchEmails")!;
    expect(() => tool.input.parse({ hasAttachments: "yes" })).toThrow();
  });
});

describe("__resetM365SeedForTest", () => {
  test("forces a fresh load on next access", async () => {
    __resetM365SeedForTest();
    resetSeedCache();
    const fresh = await getM365Seed();
    expect(fresh.users.length).toBeGreaterThan(0);
  });
});
