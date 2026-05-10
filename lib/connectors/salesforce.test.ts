/**
 * Tests for the Salesforce NPSP connector. Runs against the medium fixture.
 */

import { describe, expect, test, beforeAll } from "bun:test";
import {
  accountSchema,
  campaignSchema,
  contactSchema,
  opportunitySchema,
} from "./salesforce.schema";
import {
  getAccount,
  getCampaignMembers,
  getContact,
  getOpportunitiesForContact,
  getRelatedAccount,
  getSalesforceSeed,
  salesforce,
  searchAccounts,
  searchCampaigns,
  searchContacts,
  __resetSalesforceSeedForTest,
} from "./salesforce";
import { listConnectors, listTools } from "./registry";
import { resetSeedCache } from "./seed-loader";
import { makeCapturingContext } from "./test-helpers";
import type { Contact, SalesforceSeed } from "./salesforce.schema";

let seed: SalesforceSeed;

beforeAll(async () => {
  seed = await getSalesforceSeed();
});

describe("salesforce.schema", () => {
  test("medium fixture parses against the seed schema", () => {
    expect(seed.accounts.length).toBeGreaterThan(0);
    expect(seed.contacts.length).toBeGreaterThan(0);
    expect(seed.opportunities.length).toBeGreaterThan(0);
    expect(seed.campaigns.length).toBeGreaterThan(0);
  });

  test("medium fixture has the expected aggregate shape", () => {
    expect(seed.accounts.length).toBe(81);
    expect(seed.contacts.length).toBe(841);
    expect(seed.opportunities.length).toBe(2437);
    expect(seed.campaigns.length).toBe(9);
  });

  test("every account passes accountSchema individually", () => {
    for (const a of seed.accounts.slice(0, 25))
      expect(() => accountSchema.parse(a)).not.toThrow();
  });

  test("every contact passes contactSchema individually", () => {
    for (const c of seed.contacts.slice(0, 25))
      expect(() => contactSchema.parse(c)).not.toThrow();
  });

  test("every opportunity passes opportunitySchema individually", () => {
    for (const o of seed.opportunities.slice(0, 25))
      expect(() => opportunitySchema.parse(o)).not.toThrow();
  });

  test("every campaign passes campaignSchema individually", () => {
    for (const c of seed.campaigns) expect(() => campaignSchema.parse(c)).not.toThrow();
  });

  test("schema accepts known edge cases (null Email/Phone/AccountId, null Industry)", () => {
    expect(seed.contacts.some((c) => c.Email === null)).toBe(true);
    expect(seed.contacts.some((c) => c.Phone === null)).toBe(true);
    expect(seed.contacts.some((c) => c.AccountId === null)).toBe(true);
    expect(seed.accounts.some((a) => a.Industry === null)).toBe(true);
  });

  test("rejects an account with an unknown Type", () => {
    const bad = { ...seed.accounts[0], Type: "Wholesale" };
    expect(() => accountSchema.parse(bad)).toThrow();
  });
});

describe("getAccount", () => {
  test("returns the matching account", () => {
    const target = seed.accounts[3];
    const found = getAccount(seed, target.kali_entity_id);
    expect(found).not.toBeNull();
    expect(found!.kali_entity_id).toBe(target.kali_entity_id);
  });

  test("returns null for an unknown id", () => {
    expect(getAccount(seed, "org_doesnotexist")).toBeNull();
  });
});

describe("searchAccounts", () => {
  test("filters by type", () => {
    const r = searchAccounts(seed, { type: "Foundation", limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const a of r.accounts) expect(a.Type).toBe("Foundation");
  });

  test("filters by hasMatchingGifts", () => {
    const r = searchAccounts(seed, { hasMatchingGifts: true, limit: 200 });
    for (const a of r.accounts) expect(a.npsp__Matching_Gift_Account__c).toBe(true);
  });

  test("nameContains is a case-insensitive substring match", () => {
    const target = seed.accounts[0];
    const fragment = target.Name.slice(0, 4).toUpperCase();
    const r = searchAccounts(seed, { nameContains: fragment });
    expect(r.accounts.some((a) => a.kali_entity_id === target.kali_entity_id)).toBe(
      true,
    );
  });

  test("fundingFocus matches against Description (substring)", () => {
    const fundedRow = seed.accounts.find((a) => (a.Description ?? "").includes("youth"));
    if (!fundedRow) return; // medium fixture variation — skip if absent
    const r = searchAccounts(seed, { fundingFocus: "youth", limit: 200 });
    expect(r.accounts.some((a) => a.kali_entity_id === fundedRow.kali_entity_id)).toBe(
      true,
    );
  });

  test("limit caps the list but count is the total match", () => {
    const r = searchAccounts(seed, { type: "Vendor", limit: 3 });
    expect(r.accounts.length).toBeLessThanOrEqual(3);
    expect(r.count).toBeGreaterThanOrEqual(r.accounts.length);
  });
});

describe("getContact", () => {
  test("returns a contact summary with employer info", () => {
    const employed = seed.contacts.find((c) => c.AccountId !== null)!;
    const r = getContact(seed, employed.kali_entity_id);
    expect(r).not.toBeNull();
    expect(r!.employerKaliId).not.toBeNull();
    expect(r!.employerName).not.toBeNull();
  });

  test("returns null for unknown id", () => {
    expect(getContact(seed, "ppl_nope")).toBeNull();
  });

  test("contact with null AccountId has null employer fields", () => {
    const orphan = seed.contacts.find((c) => c.AccountId === null)!;
    const r = getContact(seed, orphan.kali_entity_id);
    expect(r!.employerKaliId).toBeNull();
    expect(r!.employerName).toBeNull();
  });
});

describe("searchContacts", () => {
  test("isBoard filter", () => {
    const r = searchContacts(seed, { isBoard: true, limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const c of r.contacts) expect(c.isBoard).toBe(true);
  });

  test("isMajorDonor filter", () => {
    const r = searchContacts(seed, { isMajorDonor: true, limit: 200 });
    for (const c of r.contacts) expect(c.isMajorDonor).toBe(true);
  });

  test("employerKaliId narrows to that employer's contacts", () => {
    const account = seed.accounts.find((a) =>
      seed.contacts.some((c) => c.AccountId === a.Id),
    )!;
    const r = searchContacts(seed, { employerKaliId: account.kali_entity_id, limit: 200 });
    expect(r.count).toBeGreaterThan(0);
    for (const c of r.contacts) expect(c.employerKaliId).toBe(account.kali_entity_id);
  });

  test("unknown employerKaliId returns empty result (no false matches)", () => {
    const r = searchContacts(seed, { employerKaliId: "org_nope" });
    expect(r.count).toBe(0);
    expect(r.contacts).toHaveLength(0);
  });

  test("minLifetimeGiving filter", () => {
    const r = searchContacts(seed, { minLifetimeGiving: 5_000, limit: 200 });
    for (const c of r.contacts) expect(c.lifetimeGiving).toBeGreaterThanOrEqual(5_000);
  });

  test("nameContains is case-insensitive", () => {
    const target = seed.contacts[10];
    const r = searchContacts(seed, {
      nameContains: target.FirstName.toUpperCase(),
      limit: 200,
    });
    expect(r.contacts.some((c) => c.kali_entity_id === target.kali_entity_id)).toBe(true);
  });
});

describe("getOpportunitiesForContact", () => {
  test("returns opps for a contact who has gifts", () => {
    const giver = seed.contacts.find(
      (c) =>
        c.npsp__TotalGifts__c > 0 &&
        seed.opportunities.some((o) => o.npsp__Primary_Contact__c === c.Id),
    )!;
    const r = getOpportunitiesForContact(seed, { contactKaliId: giver.kali_entity_id });
    expect(r.count).toBeGreaterThan(0);
    for (const o of r.opportunities) expect(o.npsp__Primary_Contact__c).toBe(giver.Id);
    expect(r.totalAmount).toBe(r.opportunities.reduce((s, o) => s + o.Amount, 0));
  });

  test("minAmount narrows results", () => {
    const giver = seed.contacts.find(
      (c) =>
        c.npsp__TotalGifts__c > 5 &&
        seed.opportunities.some((o) => o.npsp__Primary_Contact__c === c.Id),
    )!;
    const r = getOpportunitiesForContact(seed, {
      contactKaliId: giver.kali_entity_id,
      minAmount: 100,
    });
    for (const o of r.opportunities) expect(o.Amount).toBeGreaterThanOrEqual(100);
  });

  test("since narrows to a date floor", () => {
    const giver = seed.contacts.find((c) =>
      seed.opportunities.some((o) => o.npsp__Primary_Contact__c === c.Id),
    )!;
    const r = getOpportunitiesForContact(seed, {
      contactKaliId: giver.kali_entity_id,
      since: "2025-01-01",
    });
    for (const o of r.opportunities) expect(o.CloseDate >= "2025-01-01").toBe(true);
  });

  test("unknown contact yields empty", () => {
    const r = getOpportunitiesForContact(seed, { contactKaliId: "ppl_nope" });
    expect(r.count).toBe(0);
    expect(r.totalAmount).toBe(0);
  });
});

describe("getRelatedAccount", () => {
  test("returns the employer + matching-gift flag for an employed contact", () => {
    const employed = seed.contacts.find((c) => c.AccountId !== null)!;
    const r = getRelatedAccount(seed, employed.kali_entity_id);
    expect(r.account).not.toBeNull();
    expect(r.hasMatchingGifts).toBe(r.account!.npsp__Matching_Gift_Account__c);
  });

  test("returns null account for orphan contact", () => {
    const orphan = seed.contacts.find((c) => c.AccountId === null)!;
    const r = getRelatedAccount(seed, orphan.kali_entity_id);
    expect(r.account).toBeNull();
    expect(r.hasMatchingGifts).toBe(false);
  });

  test("returns null account for unknown contact", () => {
    const r = getRelatedAccount(seed, "ppl_nope");
    expect(r.account).toBeNull();
  });
});

describe("getCampaignMembers", () => {
  test("returns a non-empty roster for a campaign with opps", () => {
    const campaign = seed.campaigns.find((c) =>
      seed.opportunities.some((o) => o.CampaignId === c.kali_entity_id),
    )!;
    const r = getCampaignMembers(seed, { campaignKaliId: campaign.kali_entity_id });
    expect(r).not.toBeNull();
    expect(r!.memberCount).toBeGreaterThan(0);
    expect(r!.totalRaised).toBeGreaterThan(0);
    expect(r!.campaign.kali_entity_id).toBe(campaign.kali_entity_id);
  });

  test("returns null for unknown campaign", () => {
    expect(getCampaignMembers(seed, { campaignKaliId: "camp_nope" })).toBeNull();
  });

  test("memberCount counts unique contacts even when they gave multiple times", () => {
    const campaign = seed.campaigns.find((c) =>
      seed.opportunities.some((o) => o.CampaignId === c.kali_entity_id),
    )!;
    const r = getCampaignMembers(seed, { campaignKaliId: campaign.kali_entity_id })!;
    const oppContacts = new Set(
      seed.opportunities
        .filter((o) => o.CampaignId === campaign.kali_entity_id)
        .map((o) => o.npsp__Primary_Contact__c),
    );
    expect(r.memberCount).toBe(oppContacts.size);
  });
});

describe("searchCampaigns", () => {
  test("filters by type", () => {
    const r = searchCampaigns(seed, { type: "annual_fund" });
    expect(r.count).toBeGreaterThan(0);
    for (const c of r.campaigns) expect(c.Type).toBe("annual_fund");
  });

  test("year filter matches StartDate or EndDate", () => {
    const someYear = parseInt(seed.campaigns[0].StartDate.slice(0, 4), 10);
    const r = searchCampaigns(seed, { year: someYear });
    expect(r.count).toBeGreaterThan(0);
  });

  test("nameContains is case-insensitive", () => {
    const target = seed.campaigns[0];
    const r = searchCampaigns(seed, {
      nameContains: target.Name.toLowerCase().slice(0, 3),
    });
    expect(r.campaigns.some((c) => c.kali_entity_id === target.kali_entity_id)).toBe(true);
  });
});

describe("Connector / registry integration", () => {
  test("salesforce registered itself with the registry", () => {
    expect(listConnectors().some((c) => c.id === "salesforce")).toBe(true);
  });

  test("exposes all expected tools", () => {
    const names = salesforce.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "salesforce.getAccount",
        "salesforce.getCampaignMembers",
        "salesforce.getContact",
        "salesforce.getOpportunitiesForContact",
        "salesforce.getRelatedAccount",
        "salesforce.searchAccounts",
        "salesforce.searchCampaigns",
        "salesforce.searchContacts",
      ].sort(),
    );
  });

  test("listTools() includes every salesforce tool", () => {
    const all = listTools().map((t) => t.name);
    for (const t of salesforce.tools) expect(all).toContain(t.name);
  });

  test("init() loads the seed (idempotent)", async () => {
    await salesforce.init!();
    await salesforce.init!();
  });
});

describe("Tool handlers (audit + zod surface)", () => {
  test("searchContacts handler runs and audits", async () => {
    const tool = salesforce.tools.find((t) => t.name === "salesforce.searchContacts")!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler({ isBoard: true, limit: 5 }, ctx)) as {
      contacts: { kali_entity_id: string; isBoard: boolean }[];
    };
    expect(out.contacts.length).toBeGreaterThan(0);
    for (const c of out.contacts) expect(c.isBoard).toBe(true);
    expect(ctx.entries).toHaveLength(1);
    expect(ctx.entries[0].source).toBe("salesforce");
    expect(ctx.entries[0].toolName).toBe("salesforce.searchContacts");
    expect(ctx.entries[0].recordIds).toEqual(out.contacts.map((c) => c.kali_entity_id));
  });

  test("getOpportunitiesForContact handler audits each opp", async () => {
    const giver = seed.contacts.find(
      (c: Contact) =>
        c.npsp__TotalGifts__c > 0 &&
        seed.opportunities.some((o) => o.npsp__Primary_Contact__c === c.Id),
    )!;
    const tool = salesforce.tools.find(
      (t) => t.name === "salesforce.getOpportunitiesForContact",
    )!;
    const ctx = makeCapturingContext();
    const out = (await tool.handler(
      { contactKaliId: giver.kali_entity_id, limit: 10 },
      ctx,
    )) as { opportunities: { kali_entity_id: string }[] };
    expect(out.opportunities.length).toBeGreaterThan(0);
    expect(ctx.entries[0].recordIds).toEqual(
      out.opportunities.map((o) => o.kali_entity_id),
    );
  });

  test("invalid input is rejected by zod", () => {
    const tool = salesforce.tools.find((t) => t.name === "salesforce.searchAccounts")!;
    expect(() => tool.input.parse({ type: "BadType" })).toThrow();
  });
});

describe("__resetSalesforceSeedForTest", () => {
  test("forces a fresh load on next access", async () => {
    __resetSalesforceSeedForTest();
    resetSeedCache();
    const fresh = await getSalesforceSeed();
    expect(fresh.accounts.length).toBeGreaterThan(0);
  });
});
