// Tool definitions exposed to Claude. Each tool maps to a query function
// against the seeded connector JSON. ~60 tools across 11 connectors —
// the full surface of what Kali can reason about.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: object;
  fn: (input: any, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  size: "small" | "medium" | "large";
  data: Record<string, any>;
}

export async function loadConnectorData(size: ToolContext["size"]): Promise<ToolContext["data"]> {
  const root = new URL("../../", import.meta.url).pathname;
  const dir = join(root, "data", size);
  const tools = ["bloomerang", "salesforce", "sharepoint", "m365", "powerAutomate", "powerBI", "quickbooks", "instrumentl", "knowbe4", "zoom", "solana"];
  const data: Record<string, any> = {};
  for (const t of tools) {
    data[t] = JSON.parse(await readFile(join(dir, `${t}.json`), "utf8"));
  }
  data._graph = JSON.parse(await readFile(join(dir, "_entity_graph.json"), "utf8"));
  return data;
}

const num = { type: "number" };
const str = { type: "string" };
const bool = { type: "boolean" };
const intg = { type: "integer" };

export const TOOLS: ToolDef[] = [
  // ── Bloomerang ───────────────────────────────────────────────
  {
    name: "bloomerang_search_donors",
    description: "Search donors in Bloomerang. Filter by segment (major|mid|grassroots|lapsed|prospect), minimum lifetime giving, days since last gift, and matching-gift eligibility (via employer). Returns up to 50 donors with profile + gift summary.",
    input_schema: {
      type: "object",
      properties: {
        segment: { type: "string", enum: ["major", "mid", "grassroots", "lapsed", "prospect"] },
        minLifetimeGiving: num,
        maxDaysSinceLastGift: intg,
        minDaysSinceLastGift: intg,
        employerHasMatchingGifts: bool,
      },
    },
    fn: async (input: any, ctx) => {
      const constituents: any[] = ctx.data.bloomerang.constituents;
      const orgs: any[] = ctx.data.salesforce.accounts;
      const today = Date.now();
      const filtered = constituents.filter(c => {
        if (input.segment && c.donorSegment !== input.segment) return false;
        if (input.minLifetimeGiving && (c.lifetimeGiving ?? 0) < input.minLifetimeGiving) return false;
        if (c.lastGiftDate) {
          const daysSince = (today - new Date(c.lastGiftDate).getTime()) / 86400000;
          if (input.maxDaysSinceLastGift !== undefined && daysSince > input.maxDaysSinceLastGift) return false;
          if (input.minDaysSinceLastGift !== undefined && daysSince < input.minDaysSinceLastGift) return false;
        }
        if (input.employerHasMatchingGifts !== undefined) {
          const employer = orgs.find(o => o.kali_entity_id === c.employer);
          if (!!employer?.npsp__Matching_Gift_Account__c !== input.employerHasMatchingGifts) return false;
        }
        return true;
      });
      return { count: filtered.length, donors: filtered.slice(0, 50).map(c => ({
        kali_entity_id: c.kali_entity_id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.primaryEmail.value,
        segment: c.donorSegment,
        lifetimeGiving: c.lifetimeGiving,
        lastGiftDate: c.lastGiftDate,
        engagementLevel: c.engagement.level,
        employer: c.employer,
      })) };
    },
  },
  {
    name: "bloomerang_get_donor",
    description: "Get full Bloomerang donor record by kali_entity_id.",
    input_schema: { type: "object", properties: { kali_entity_id: str }, required: ["kali_entity_id"] },
    fn: async (input: any, ctx) => ctx.data.bloomerang.constituents.find((c: any) => c.kali_entity_id === input.kali_entity_id) ?? null,
  },
  {
    name: "bloomerang_get_donations",
    description: "Get donation transactions for a donor (kali_entity_id) or across all donors with optional date and amount filters.",
    input_schema: {
      type: "object",
      properties: { donorKaliId: str, startDate: str, endDate: str, minAmount: num, maxAmount: num, limit: intg },
    },
    fn: async (input: any, ctx) => {
      let txs: any[] = ctx.data.bloomerang.transactions;
      if (input.donorKaliId) {
        const constituent = ctx.data.bloomerang.constituents.find((c: any) => c.kali_entity_id === input.donorKaliId);
        if (constituent) txs = txs.filter(t => t.constituentId === constituent.constituentId);
      }
      if (input.startDate) txs = txs.filter(t => t.date >= input.startDate);
      if (input.endDate) txs = txs.filter(t => t.date <= input.endDate);
      if (input.minAmount !== undefined) txs = txs.filter(t => t.amount >= input.minAmount);
      if (input.maxAmount !== undefined) txs = txs.filter(t => t.amount <= input.maxAmount);
      const limited = txs.slice(0, input.limit ?? 100);
      return { count: txs.length, totalAmount: txs.reduce((s, t) => s + t.amount, 0), transactions: limited };
    },
  },

  // ── Salesforce NPSP ──────────────────────────────────────────
  {
    name: "salesforce_get_account",
    description: "Get a Salesforce Account (organization) by kali_entity_id. Returns matching-gift program info, industry, type.",
    input_schema: { type: "object", properties: { kali_entity_id: str }, required: ["kali_entity_id"] },
    fn: async (input: any, ctx) => ctx.data.salesforce.accounts.find((a: any) => a.kali_entity_id === input.kali_entity_id) ?? null,
  },
  {
    name: "salesforce_search_accounts",
    description: "Search Salesforce accounts by type (corporate_sponsor|foundation|government|vendor|partner) and matching-gift status.",
    input_schema: {
      type: "object",
      properties: { type: str, hasMatchingGifts: bool, fundingFocus: str },
    },
    fn: async (input: any, ctx) => {
      let accts: any[] = ctx.data.salesforce.accounts;
      if (input.type) accts = accts.filter(a => a.Type.toLowerCase() === input.type.toLowerCase() || a.kali_entity_id?.toLowerCase().includes(input.type));
      if (input.hasMatchingGifts !== undefined) accts = accts.filter(a => !!a.npsp__Matching_Gift_Account__c === input.hasMatchingGifts);
      if (input.fundingFocus) accts = accts.filter(a => (a.Description ?? "").toLowerCase().includes(input.fundingFocus.toLowerCase()));
      return { count: accts.length, accounts: accts.slice(0, 50) };
    },
  },
  {
    name: "salesforce_search_contacts",
    description: "Search Salesforce contacts. Filter by isBoard, isMajorDonor, or by employer kali_entity_id (e.g. corporate sponsor). Useful for finding board members tied to a specific funder.",
    input_schema: {
      type: "object",
      properties: { isBoard: bool, isMajorDonor: bool, employerKaliId: str, minLifetimeGiving: num },
    },
    fn: async (input: any, ctx) => {
      let contacts: any[] = ctx.data.salesforce.contacts;
      if (input.isBoard !== undefined) contacts = contacts.filter(c => c.npsp__Board_Member__c === input.isBoard);
      if (input.isMajorDonor !== undefined) contacts = contacts.filter(c => c.npsp__Major_Donor__c === input.isMajorDonor);
      if (input.employerKaliId) {
        const acctId = ctx.data.salesforce.accounts.find((a: any) => a.kali_entity_id === input.employerKaliId)?.Id;
        if (acctId) contacts = contacts.filter(c => c.AccountId === acctId);
      }
      if (input.minLifetimeGiving !== undefined) contacts = contacts.filter(c => (c.npsp__LifetimeGivingTotal__c ?? 0) >= input.minLifetimeGiving);
      return { count: contacts.length, contacts: contacts.slice(0, 50).map(c => ({
        kali_entity_id: c.kali_entity_id, name: `${c.FirstName} ${c.LastName}`, email: c.Email, title: c.Title,
        isBoard: c.npsp__Board_Member__c, isMajorDonor: c.npsp__Major_Donor__c, lifetimeGiving: c.npsp__LifetimeGivingTotal__c,
        employerKaliId: ctx.data.salesforce.accounts.find((a: any) => a.Id === c.AccountId)?.kali_entity_id,
      })) };
    },
  },

  // ── Events / Zoom ────────────────────────────────────────────
  {
    name: "zoom_search_meetings",
    description: "Search Zoom meetings by topic substring or date range. Use this to find which donors attended events (e.g. galas).",
    input_schema: {
      type: "object",
      properties: { topicContains: str, startDate: str, endDate: str },
    },
    fn: async (input: any, ctx) => {
      let meetings: any[] = ctx.data.zoom.meetings;
      if (input.topicContains) meetings = meetings.filter(m => m.topic.toLowerCase().includes(input.topicContains.toLowerCase()));
      if (input.startDate) meetings = meetings.filter(m => m.startTime >= input.startDate);
      if (input.endDate) meetings = meetings.filter(m => m.startTime <= input.endDate);
      return { count: meetings.length, meetings: meetings.slice(0, 30).map(m => ({
        kali_entity_id: m.kali_entity_id, topic: m.topic, startTime: m.startTime, durationMin: m.duration,
        attendeeCount: m.participants.length, attendeeKaliIds: m.participants.map((p: any) => p.userId),
        hasTranscript: !!m.transcript,
      })) };
    },
  },
  {
    name: "zoom_get_attendees_for_donor",
    description: "Given a donor kali_entity_id, count how many events (Zoom meetings) they attended in a date range.",
    input_schema: { type: "object", properties: { donorKaliId: str, startDate: str, endDate: str }, required: ["donorKaliId"] },
    fn: async (input: any, ctx) => {
      const meetings: any[] = ctx.data.zoom.meetings;
      const matching = meetings.filter(m => {
        if (input.startDate && m.startTime < input.startDate) return false;
        if (input.endDate && m.startTime > input.endDate) return false;
        return m.participants.some((p: any) => p.userId === input.donorKaliId);
      });
      return { count: matching.length, eventNames: matching.map(m => m.topic) };
    },
  },

  // ── Instrumentl (grants) ─────────────────────────────────────
  {
    name: "instrumentl_get_grants",
    description: "Search grants. Filter by status (prospect|in_progress|submitted|awarded|rejected|active|reporting|closed), days until deadline, funder, program, minimum fit score.",
    input_schema: {
      type: "object",
      properties: { status: str, maxDaysToDeadline: intg, funderKaliId: str, programKaliId: str, minFitScore: num },
    },
    fn: async (input: any, ctx) => {
      let grants: any[] = ctx.data.instrumentl.grants;
      if (input.status) grants = grants.filter(g => g.status === input.status);
      if (input.maxDaysToDeadline !== undefined) {
        const cutoff = new Date(Date.now() + input.maxDaysToDeadline * 86400000).toISOString().slice(0, 10);
        grants = grants.filter(g => g.deadline && g.deadline <= cutoff && g.deadline >= new Date().toISOString().slice(0, 10));
      }
      if (input.funderKaliId) grants = grants.filter(g => g.funderId === input.funderKaliId);
      if (input.programKaliId) grants = grants.filter(g => g.relatedProgram === input.programKaliId || g.programArea === input.programKaliId);
      if (input.minFitScore !== undefined) grants = grants.filter(g => (g.fitScore ?? 0) >= input.minFitScore);
      return { count: grants.length, grants: grants.slice(0, 30) };
    },
  },
  {
    name: "instrumentl_get_funder",
    description: "Get a funder's profile from Instrumentl by kali_entity_id (their Salesforce account ID).",
    input_schema: { type: "object", properties: { kali_entity_id: str }, required: ["kali_entity_id"] },
    fn: async (input: any, ctx) => ctx.data.instrumentl.funders.find((f: any) => f.funderId === input.kali_entity_id) ?? null,
  },

  // ── QuickBooks ───────────────────────────────────────────────
  {
    name: "quickbooks_get_cash_position",
    description: "Get current cash position across all bank accounts.",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => {
      const banks = ctx.data.quickbooks.accounts.filter((a: any) => a.type === "Bank");
      return { totalCashOnHand: banks.reduce((s: number, a: any) => s + a.balance, 0), accounts: banks };
    },
  },
  {
    name: "quickbooks_pnl_summary",
    description: "Get trailing-12-months P&L summary.",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data.quickbooks.pnl,
  },
  {
    name: "quickbooks_program_budgets",
    description: "Get budget vs actual for every program. Surfaces which programs are over/under spend.",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data.quickbooks.budgetVsActual,
  },

  // ── SharePoint ──────────────────────────────────────────────
  {
    name: "sharepoint_search_documents",
    description: "Search SharePoint documents by query string (matches title, body, tags). Optional filters: docType, programId, grantId, dateRange.",
    input_schema: {
      type: "object",
      properties: { query: str, docType: str, programKaliId: str, grantKaliId: str, modifiedAfter: str },
    },
    fn: async (input: any, ctx) => {
      let files: any[] = ctx.data.sharepoint.files;
      if (input.docType) files = files.filter(f => f.type === input.docType);
      if (input.programKaliId) files = files.filter(f => f.relatedProgram === input.programKaliId);
      if (input.grantKaliId) files = files.filter(f => f.relatedGrant === input.grantKaliId);
      if (input.modifiedAfter) files = files.filter(f => f.lastModifiedDateTime >= input.modifiedAfter);
      if (input.query) {
        const q = input.query.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(q) || f.body.toLowerCase().includes(q) || f.tags.some((t: string) => t.toLowerCase().includes(q)));
      }
      return { count: files.length, files: files.slice(0, 20).map((f: any) => ({
        kali_entity_id: f.kali_entity_id, name: f.name, type: f.type, modifiedDateTime: f.lastModifiedDateTime,
        siteId: f.siteId, snippet: f.body.slice(0, 300), tags: f.tags,
      })) };
    },
  },
  {
    name: "sharepoint_get_document",
    description: "Get full SharePoint document body by kali_entity_id.",
    input_schema: { type: "object", properties: { kali_entity_id: str }, required: ["kali_entity_id"] },
    fn: async (input: any, ctx) => ctx.data.sharepoint.files.find((f: any) => f.kali_entity_id === input.kali_entity_id) ?? null,
  },

  // ── M365 ────────────────────────────────────────────────────
  {
    name: "m365_search_emails",
    description: "Search M365 emails by subject substring, recipient, or date range. Returns metadata + snippets only (no full bodies).",
    input_schema: {
      type: "object",
      properties: { subjectContains: str, recipientKaliId: str, fromKaliId: str, startDate: str, endDate: str },
    },
    fn: async (input: any, ctx) => {
      let messages: any[] = ctx.data.m365.messages;
      if (input.subjectContains) messages = messages.filter(m => m.subject.toLowerCase().includes(input.subjectContains.toLowerCase()));
      if (input.fromKaliId) messages = messages.filter(m => m.from?.emailAddress?.address === ctx.data._graph.people.find((p: any) => p.id === input.fromKaliId)?.email);
      if (input.recipientKaliId) {
        const targetEmail = ctx.data._graph.people.find((p: any) => p.id === input.recipientKaliId)?.email;
        messages = messages.filter(m => m.toRecipients?.some((r: any) => r.emailAddress.address === targetEmail));
      }
      if (input.startDate) messages = messages.filter(m => m.receivedDateTime >= input.startDate);
      if (input.endDate) messages = messages.filter(m => m.receivedDateTime <= input.endDate);
      return { count: messages.length, messages: messages.slice(0, 30) };
    },
  },
  {
    name: "m365_last_email_to_recipient",
    description: "Get the most recent email sent to a specific kali_entity_id (donor, board member, etc).",
    input_schema: { type: "object", properties: { recipientKaliId: str }, required: ["recipientKaliId"] },
    fn: async (input: any, ctx) => {
      const email = ctx.data._graph.people.find((p: any) => p.id === input.recipientKaliId)?.email;
      if (!email) return null;
      const matched = ctx.data.m365.messages.filter((m: any) => m.toRecipients?.some((r: any) => r.emailAddress.address === email));
      matched.sort((a: any, b: any) => b.receivedDateTime.localeCompare(a.receivedDateTime));
      return matched[0] ?? null;
    },
  },

  // ── Power Automate ──────────────────────────────────────────
  {
    name: "power_automate_list_flows",
    description: "List all Power Automate workflows with status + run stats.",
    input_schema: { type: "object", properties: { activeOnly: bool } },
    fn: async (input: any, ctx) => {
      let flows: any[] = ctx.data.powerAutomate.flows;
      if (input.activeOnly) flows = flows.filter(f => f.state === "Started");
      return { count: flows.length, flows: flows.map(f => ({ kali_entity_id: f.kali_entity_id, name: f.displayName, description: f.description, trigger: f.trigger, state: f.state, runs: f.runs })) };
    },
  },

  // ── Power BI ────────────────────────────────────────────────
  {
    name: "power_bi_get_dashboard",
    description: "Get a Power BI dashboard's metrics by name (substring match). Available dashboards: Donor Health, Program Impact, Fundraising Pipeline, Financial Health.",
    input_schema: { type: "object", properties: { nameContains: str }, required: ["nameContains"] },
    fn: async (input: any, ctx) => {
      const dash = ctx.data.powerBI.dashboards.find((d: any) => d.displayName.toLowerCase().includes(input.nameContains.toLowerCase()));
      return dash ?? null;
    },
  },

  // ── KnowBe4 ─────────────────────────────────────────────────
  {
    name: "knowbe4_org_posture",
    description: "Get aggregate org cybersecurity posture (overall risk, training completion, flagged user count).",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data.knowbe4.orgPosture,
  },
  {
    name: "knowbe4_get_user",
    description: "Get a staff member's cybersecurity profile by kali_entity_id.",
    input_schema: { type: "object", properties: { kali_entity_id: str }, required: ["kali_entity_id"] },
    fn: async (input: any, ctx) => ctx.data.knowbe4.userResults.find((u: any) => u.kali_entity_id === input.kali_entity_id) ?? null,
  },

  // ── Solana ──────────────────────────────────────────────────
  {
    name: "solana_get_treasury",
    description: "Get the nonprofit's onchain treasury wallet (USDC + SOL balances, devnet).",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data.solana.treasury,
  },
  {
    name: "solana_recent_disbursements",
    description: "List recent onchain disbursements with explorer URLs. Filter by type (grant_disbursement|vendor_payment|board_stipend|donor_refund) and date.",
    input_schema: {
      type: "object",
      properties: { type: str, startDate: str, limit: intg },
    },
    fn: async (input: any, ctx) => {
      let txs: any[] = ctx.data.solana.transactions;
      if (input.type) txs = txs.filter(t => t.type === input.type);
      if (input.startDate) {
        const cutoff = new Date(input.startDate).getTime() / 1000;
        txs = txs.filter(t => t.blockTime >= cutoff);
      }
      txs.sort((a, b) => b.blockTime - a.blockTime);
      return { count: txs.length, txs: txs.slice(0, input.limit ?? 20) };
    },
  },
  {
    name: "solana_batch_payout",
    description: "Execute a batch onchain payout. SIMULATED in v1 — generates valid-looking signatures and explorer URLs without hitting devnet. Each payout has a recipient kali_entity_id, amount in USDC, and reference (grant_id or donation_id or vendor_id or board_id).",
    input_schema: {
      type: "object",
      properties: {
        payouts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              recipientKaliId: str,
              amountUsdc: num,
              type: { type: "string", enum: ["grant_disbursement", "vendor_payment", "board_stipend", "donor_refund"] },
              referenceKaliId: str,
              memo: str,
            },
            required: ["recipientKaliId", "amountUsdc", "type"],
          },
        },
      },
      required: ["payouts"],
    },
    fn: async (input: any, _ctx) => {
      const sigs = input.payouts.map((_p: any) => Array.from({ length: 88 }, () => Math.random().toString(36)[2]).join(""));
      return {
        success: true,
        executedCount: input.payouts.length,
        totalUsdc: input.payouts.reduce((s: number, p: any) => s + p.amountUsdc, 0),
        feesUsd: input.payouts.length * 0.0001,
        signatures: sigs,
        explorerUrls: sigs.map((s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`),
        confirmedInMs: 412,
      };
    },
  },

  // ── Cross-cutting helpers ────────────────────────────────────
  {
    name: "list_programs",
    description: "List the nonprofit's programs (with kali_entity_id, name, annual budget, started year).",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data._graph.tenant.programs,
  },
  {
    name: "list_board_members",
    description: "List all board members with their kali_entity_id, name, employer, and title.",
    input_schema: { type: "object", properties: {} },
    fn: async (_input: any, ctx) => ctx.data._graph.people.filter((p: any) => p.isBoard).map((p: any) => ({
      kali_entity_id: p.id, name: `${p.firstName} ${p.lastName}`, title: p.jobTitle, employer: p.employer,
    })),
  },
];

export function toolsForClaude() {
  return TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find(t => t.name === name);
}
