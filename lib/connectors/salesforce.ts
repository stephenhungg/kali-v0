/**
 * Salesforce NPSP connector — CRM, contacts, opportunities, campaigns.
 *
 * Salesforce sits next to Bloomerang as the second source of donor + gift
 * truth — the agent uses it for board membership, employer affiliations,
 * matching-gift eligibility, and the campaign rollup. Cross-references via
 * `kali_entity_id` mean a donor lookup pulls coherent data from both systems.
 *
 * Real-OAuth path: Salesforce OAuth 2.0 → REST + Bulk API 2.0. NPSP custom
 * objects come through metadata API. ~3 weeks for production with proper
 * soft-delete handling.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  accountSchema,
  accountTypeSchema,
  campaignSchema,
  opportunitySchema,
  salesforceSeedSchema,
  type Account,
  type Campaign,
  type Contact,
  type Opportunity,
  type SalesforceSeed,
} from "./salesforce.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<SalesforceSeed> | null = null;

export async function getSalesforceSeed(size?: SeedSize): Promise<SalesforceSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("salesforce", salesforceSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetSalesforceSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

const SEARCH_LIMIT = 50;

export interface SearchAccountsArgs {
  type?: Account["Type"];
  hasMatchingGifts?: boolean;
  nameContains?: string;
  /** Substring match against the Description field (where funding focus lives). */
  fundingFocus?: string;
  limit?: number;
}

export function getAccount(
  seed: SalesforceSeed,
  kaliEntityId: string,
): Account | null {
  return seed.accounts.find((a) => a.kali_entity_id === kaliEntityId) ?? null;
}

export function searchAccounts(
  seed: SalesforceSeed,
  args: SearchAccountsArgs,
): { count: number; accounts: Account[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const out: Account[] = [];
  for (const a of seed.accounts) {
    if (args.type && a.Type !== args.type) continue;
    if (
      args.hasMatchingGifts !== undefined &&
      a.npsp__Matching_Gift_Account__c !== args.hasMatchingGifts
    )
      continue;
    if (args.nameContains && !a.Name.toLowerCase().includes(args.nameContains.toLowerCase()))
      continue;
    if (args.fundingFocus) {
      const focus = (a.Description ?? "").toLowerCase();
      if (!focus.includes(args.fundingFocus.toLowerCase())) continue;
    }
    out.push(a);
  }
  return { count: out.length, accounts: out.slice(0, limit) };
}

export interface SearchContactsArgs {
  isBoard?: boolean;
  isMajorDonor?: boolean;
  employerKaliId?: string;
  minLifetimeGiving?: number;
  nameContains?: string;
  limit?: number;
}

export interface ContactSummary {
  kali_entity_id: string;
  name: string;
  email: string | null;
  title: string | null;
  isBoard: boolean;
  isMajorDonor: boolean;
  lifetimeGiving: number;
  totalGifts: number;
  lastDonationDate: string | null;
  employerKaliId: string | null;
  employerName: string | null;
}

function toContactSummary(c: Contact, accountsById: Map<string, Account>): ContactSummary {
  const account = c.AccountId ? accountsById.get(c.AccountId) ?? null : null;
  return {
    kali_entity_id: c.kali_entity_id,
    name: `${c.FirstName} ${c.LastName}`.trim(),
    email: c.Email,
    title: c.Title,
    isBoard: c.npsp__Board_Member__c,
    isMajorDonor: c.npsp__Major_Donor__c,
    lifetimeGiving: c.npsp__LifetimeGivingTotal__c,
    totalGifts: c.npsp__TotalGifts__c,
    lastDonationDate: c.npsp__LastDonationDate__c,
    employerKaliId: account?.kali_entity_id ?? null,
    employerName: account?.Name ?? null,
  };
}

function indexAccounts(seed: SalesforceSeed): Map<string, Account> {
  return new Map(seed.accounts.map((a) => [a.Id, a]));
}

export function getContact(
  seed: SalesforceSeed,
  kaliEntityId: string,
): ContactSummary | null {
  const c = seed.contacts.find((x) => x.kali_entity_id === kaliEntityId);
  if (!c) return null;
  return toContactSummary(c, indexAccounts(seed));
}

export function searchContacts(
  seed: SalesforceSeed,
  args: SearchContactsArgs,
): { count: number; contacts: ContactSummary[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const accountsById = indexAccounts(seed);
  const employerSfId = args.employerKaliId
    ? seed.accounts.find((a) => a.kali_entity_id === args.employerKaliId)?.Id ?? null
    : null;
  if (args.employerKaliId && !employerSfId) {
    return { count: 0, contacts: [] };
  }

  const out: Contact[] = [];
  for (const c of seed.contacts) {
    if (args.isBoard !== undefined && c.npsp__Board_Member__c !== args.isBoard) continue;
    if (args.isMajorDonor !== undefined && c.npsp__Major_Donor__c !== args.isMajorDonor)
      continue;
    if (employerSfId && c.AccountId !== employerSfId) continue;
    if (
      args.minLifetimeGiving !== undefined &&
      c.npsp__LifetimeGivingTotal__c < args.minLifetimeGiving
    )
      continue;
    if (args.nameContains) {
      const q = args.nameContains.toLowerCase();
      const fullName = `${c.FirstName} ${c.LastName}`.toLowerCase();
      if (!fullName.includes(q)) continue;
    }
    out.push(c);
  }
  return {
    count: out.length,
    contacts: out.slice(0, limit).map((c) => toContactSummary(c, accountsById)),
  };
}

export interface OpportunitiesForContactArgs {
  contactKaliId: string;
  minAmount?: number;
  since?: string;
  limit?: number;
}

export function getOpportunitiesForContact(
  seed: SalesforceSeed,
  args: OpportunitiesForContactArgs,
): { count: number; totalAmount: number; opportunities: Opportunity[] } {
  const contact = seed.contacts.find((c) => c.kali_entity_id === args.contactKaliId);
  if (!contact) return { count: 0, totalAmount: 0, opportunities: [] };
  let opps = seed.opportunities.filter((o) => o.npsp__Primary_Contact__c === contact.Id);
  if (args.minAmount !== undefined) opps = opps.filter((o) => o.Amount >= args.minAmount!);
  if (args.since) opps = opps.filter((o) => o.CloseDate >= args.since!);
  const totalAmount = opps.reduce((s, o) => s + o.Amount, 0);
  const limit = Math.min(args.limit ?? 100, 1_000);
  return { count: opps.length, totalAmount, opportunities: opps.slice(0, limit) };
}

export interface RelatedAccount {
  contactKaliId: string;
  account: Account | null;
  hasMatchingGifts: boolean;
}

export function getRelatedAccount(
  seed: SalesforceSeed,
  contactKaliId: string,
): RelatedAccount {
  const contact = seed.contacts.find((c) => c.kali_entity_id === contactKaliId);
  if (!contact) return { contactKaliId, account: null, hasMatchingGifts: false };
  if (!contact.AccountId)
    return { contactKaliId, account: null, hasMatchingGifts: false };
  const account = seed.accounts.find((a) => a.Id === contact.AccountId) ?? null;
  return {
    contactKaliId,
    account,
    hasMatchingGifts: account?.npsp__Matching_Gift_Account__c ?? false,
  };
}

export interface CampaignMembersResult {
  campaign: Campaign;
  memberCount: number;
  totalRaised: number;
  members: ContactSummary[];
}

export function getCampaignMembers(
  seed: SalesforceSeed,
  args: { campaignKaliId: string; limit?: number },
): CampaignMembersResult | null {
  const campaign = seed.campaigns.find(
    (c) => c.kali_entity_id === args.campaignKaliId,
  );
  if (!campaign) return null;

  const opps = seed.opportunities.filter((o) => o.CampaignId === campaign.kali_entity_id);
  const accountsById = indexAccounts(seed);
  const contactsById = new Map(seed.contacts.map((c) => [c.Id, c]));

  const memberMap = new Map<string, { contact: Contact; raised: number; gifts: number }>();
  for (const o of opps) {
    const c = contactsById.get(o.npsp__Primary_Contact__c);
    if (!c) continue;
    const entry = memberMap.get(c.Id) ?? { contact: c, raised: 0, gifts: 0 };
    entry.raised += o.Amount;
    entry.gifts += 1;
    memberMap.set(c.Id, entry);
  }

  const limit = Math.min(args.limit ?? 100, 1_000);
  const members: ContactSummary[] = [];
  let totalRaised = 0;
  for (const { contact, raised } of memberMap.values()) {
    totalRaised += raised;
    if (members.length < limit) members.push(toContactSummary(contact, accountsById));
  }
  return { campaign, memberCount: memberMap.size, totalRaised, members };
}

export function searchCampaigns(
  seed: SalesforceSeed,
  args: { type?: string; year?: number; nameContains?: string; limit?: number },
): { count: number; campaigns: Campaign[] } {
  let out = seed.campaigns;
  if (args.type) out = out.filter((c) => c.Type === args.type);
  if (args.year !== undefined) {
    const y = String(args.year);
    out = out.filter((c) => c.StartDate.startsWith(y) || c.EndDate.startsWith(y));
  }
  if (args.nameContains) {
    const q = args.nameContains.toLowerCase();
    out = out.filter((c) => c.Name.toLowerCase().includes(q));
  }
  const limit = Math.min(args.limit ?? 50, 200);
  return { count: out.length, campaigns: out.slice(0, limit) };
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const contactSummarySchema = z.object({
  kali_entity_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  title: z.string().nullable(),
  isBoard: z.boolean(),
  isMajorDonor: z.boolean(),
  lifetimeGiving: z.number(),
  totalGifts: z.number(),
  lastDonationDate: z.string().nullable(),
  employerKaliId: z.string().nullable(),
  employerName: z.string().nullable(),
});

const relatedAccountSchema = z.object({
  contactKaliId: z.string(),
  account: accountSchema.nullable(),
  hasMatchingGifts: z.boolean(),
});

const campaignMembersOutput = z
  .object({
    campaign: campaignSchema,
    memberCount: z.number().int().nonnegative(),
    totalRaised: z.number(),
    members: z.array(contactSummarySchema),
  })
  .nullable();

const makeTool = makeToolFactory<SalesforceSeed>("salesforce", getSalesforceSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "salesforce.getAccount",
    description:
      "Get a Salesforce Account (organization) by kali_entity_id. Returns null if missing.",
    domain: "donor",
    input: z.object({ kali_entity_id: z.string() }),
    output: accountSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getAccount(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "salesforce.searchAccounts",
    description:
      "Search Salesforce accounts. Filter by type (Corporate | Foundation | Government | Vendor | Partner), matching-gift status, name substring, and Description-funding-focus substring.",
    domain: "donor",
    input: z.object({
      type: accountTypeSchema.optional(),
      hasMatchingGifts: z.boolean().optional(),
      nameContains: z.string().optional(),
      fundingFocus: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      accounts: z.array(accountSchema),
    }),
    collectRecordIds: (out) => out.accounts.map((a) => a.kali_entity_id),
    run: (seed, input) => searchAccounts(seed, input),
  }),

  makeTool({
    name: "salesforce.getContact",
    description:
      "Get a Salesforce Contact summary by kali_entity_id. Includes employer affiliation. Returns null if missing.",
    domain: "donor",
    input: z.object({ kali_entity_id: z.string() }),
    output: contactSummarySchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getContact(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "salesforce.searchContacts",
    description:
      "Search Salesforce contacts. Filter by board membership, major-donor flag, employer (kali_entity_id), minimum lifetime giving, and name substring. Each row includes employer name + matching-gift status.",
    domain: "donor",
    input: z.object({
      isBoard: z.boolean().optional(),
      isMajorDonor: z.boolean().optional(),
      employerKaliId: z.string().optional(),
      minLifetimeGiving: z.number().nonnegative().optional(),
      nameContains: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      contacts: z.array(contactSummarySchema),
    }),
    collectRecordIds: (out) => out.contacts.map((c) => c.kali_entity_id),
    run: (seed, input) => searchContacts(seed, input),
  }),

  makeTool({
    name: "salesforce.getOpportunitiesForContact",
    description:
      "Get a contact's gift history (Opportunities). Filter by minimum amount and since-date. Returns count, total amount, and opps.",
    domain: "donor",
    input: z.object({
      contactKaliId: z.string(),
      minAmount: z.number().optional(),
      since: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      totalAmount: z.number(),
      opportunities: z.array(opportunitySchema),
    }),
    collectRecordIds: (out) => out.opportunities.map((o) => o.kali_entity_id),
    run: (seed, input) => getOpportunitiesForContact(seed, input),
  }),

  makeTool({
    name: "salesforce.getRelatedAccount",
    description:
      "Get the Account a Contact rolls up to (their employer / sponsoring org). Includes whether that org has a matching-gift program.",
    domain: "donor",
    input: z.object({ contactKaliId: z.string() }),
    output: relatedAccountSchema,
    collectRecordIds: (out) => (out.account ? [out.account.kali_entity_id] : []),
    run: (seed, input) => getRelatedAccount(seed, input.contactKaliId),
  }),

  makeTool({
    name: "salesforce.getCampaignMembers",
    description:
      "Given a campaign kali_entity_id, return the contacts who gave to it, with totals raised and per-contact summaries. Useful for finding lapsed donors who attended a specific campaign.",
    domain: "donor",
    input: z.object({
      campaignKaliId: z.string(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: campaignMembersOutput,
    collectRecordIds: (out) => (out ? out.members.map((c) => c.kali_entity_id) : []),
    run: (seed, input) => getCampaignMembers(seed, input),
  }),

  makeTool({
    name: "salesforce.searchCampaigns",
    description:
      "Search Salesforce campaigns. Filter by type (annual_fund | year_end | giving_tuesday | program_specific | …), year, and name substring.",
    domain: "donor",
    input: z.object({
      type: z.string().optional(),
      year: z.number().int().optional(),
      nameContains: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      campaigns: z.array(campaignSchema),
    }),
    collectRecordIds: (out) => out.campaigns.map((c) => c.kali_entity_id),
    run: (seed, input) => searchCampaigns(seed, input),
  }),
];

export const salesforce: Connector = {
  id: "salesforce",
  label: "Salesforce NPSP",
  domain: "donor",
  tools,
  init: async () => {
    await getSalesforceSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(salesforce);
  registered = true;
}

ensureRegistered();
