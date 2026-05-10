/**
 * Microsoft 365 connector — email, profiles, calendars, distribution lists.
 *
 * Powers cross-tool queries like "when did we last contact this donor" by
 * searching message metadata, and "what does Sarah's week look like" by
 * pulling calendar events. The seed only covers staff (`m365.users` is the
 * directory) — non-staff (donors, board, vendors) appear as `to`/`from`
 * email addresses without a kali id surfaced in this connector. The agent
 * resolves those by chaining through `salesforce.getContact` or
 * `bloomerang.getDonor` first to get an email, then querying m365.
 *
 * Real-OAuth path: Microsoft Graph (Mail.Read.Shared, Calendars.Read,
 * User.Read.All). Admin consent required for org-wide reads. ~2 weeks.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  m365CalendarEventSchema,
  m365DistributionListSchema,
  m365MessageSchema,
  m365SeedSchema,
  m365UserSchema,
  type M365CalendarEvent,
  type M365Message,
  type M365Seed,
  type M365User,
} from "./m365.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<M365Seed> | null = null;

export async function getM365Seed(size?: SeedSize): Promise<M365Seed> {
  if (!seedPromise) {
    seedPromise = loadSeed("m365", m365SeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetM365SeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

const SEARCH_LIMIT = 50;

export function getUser(seed: M365Seed, kaliEntityId: string): M365User | null {
  return seed.users.find((u) => u.kali_entity_id === kaliEntityId) ?? null;
}

/** Resolve a kali_entity_id to an email — staff only (m365.users coverage). */
function staffEmail(seed: M365Seed, kaliEntityId: string): string | null {
  const u = seed.users.find((x) => x.kali_entity_id === kaliEntityId);
  return u?.userPrincipalName ?? null;
}

export interface SearchUsersArgs {
  department?: string;
  jobTitleContains?: string;
  nameContains?: string;
  limit?: number;
}

export function searchUsers(
  seed: M365Seed,
  args: SearchUsersArgs,
): { count: number; users: M365User[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const out: M365User[] = [];
  for (const u of seed.users) {
    if (args.department && u.department.toLowerCase() !== args.department.toLowerCase())
      continue;
    if (
      args.jobTitleContains &&
      !(u.jobTitle ?? "").toLowerCase().includes(args.jobTitleContains.toLowerCase())
    )
      continue;
    if (
      args.nameContains &&
      !u.displayName.toLowerCase().includes(args.nameContains.toLowerCase())
    )
      continue;
    out.push(u);
  }
  return { count: out.length, users: out.slice(0, limit) };
}

export interface SearchEmailsArgs {
  subjectContains?: string;
  bodyContains?: string;
  fromEmail?: string;
  /** Resolves to fromEmail via the staff directory. Caller can pass either. */
  fromKaliId?: string;
  recipientEmail?: string;
  startDate?: string;
  endDate?: string;
  hasAttachments?: boolean;
  conversationId?: string;
  limit?: number;
}

export function searchEmails(
  seed: M365Seed,
  args: SearchEmailsArgs,
): { count: number; messages: M365Message[] } {
  const limit = Math.min(args.limit ?? 100, 1_000);

  // Resolve `fromEmail`. If the caller passed a kali id but it doesn't map
  // to a staff member, treat it as a "filter requested but unresolved" — we
  // intentionally return zero results rather than silently dropping the
  // filter (which would return *every* email and confuse the agent).
  let fromEmail: string | null = null;
  if (args.fromEmail) {
    fromEmail = args.fromEmail;
  } else if (args.fromKaliId) {
    const resolved = staffEmail(seed, args.fromKaliId);
    if (resolved === null) return { count: 0, messages: [] };
    fromEmail = resolved;
  }

  const out: M365Message[] = [];
  for (const m of seed.messages) {
    if (args.subjectContains) {
      if (!m.subject.toLowerCase().includes(args.subjectContains.toLowerCase()))
        continue;
    }
    if (args.bodyContains) {
      if (!m.bodyPreview.toLowerCase().includes(args.bodyContains.toLowerCase()))
        continue;
    }
    if (fromEmail) {
      if (m.from.emailAddress.address !== fromEmail) continue;
    }
    if (args.recipientEmail) {
      const hit = m.toRecipients.some(
        (r) => r.emailAddress.address === args.recipientEmail,
      );
      if (!hit) continue;
    }
    if (args.startDate && m.receivedDateTime < args.startDate) continue;
    if (args.endDate && m.receivedDateTime > args.endDate) continue;
    if (args.hasAttachments !== undefined && m.hasAttachments !== args.hasAttachments)
      continue;
    if (args.conversationId && m.conversationId !== args.conversationId) continue;
    out.push(m);
  }
  return { count: out.length, messages: out.slice(0, limit) };
}

export function getEmailThread(
  seed: M365Seed,
  conversationId: string,
): { conversationId: string; count: number; messages: M365Message[] } {
  const messages = seed.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime));
  return { conversationId, count: messages.length, messages };
}

export function getLastEmailToEmail(
  seed: M365Seed,
  recipientEmail: string,
): M365Message | null {
  let latest: M365Message | null = null;
  for (const m of seed.messages) {
    if (!m.toRecipients.some((r) => r.emailAddress.address === recipientEmail))
      continue;
    if (!latest || m.receivedDateTime > latest.receivedDateTime) latest = m;
  }
  return latest;
}

export interface CalendarSearchArgs {
  ownerEmail?: string;
  ownerKaliId?: string;
  startDate?: string;
  endDate?: string;
  subjectContains?: string;
  limit?: number;
}

export function getCalendarEvents(
  seed: M365Seed,
  args: CalendarSearchArgs,
): { count: number; events: M365CalendarEvent[] } {
  const limit = Math.min(args.limit ?? 100, 1_000);

  let ownerEmail: string | null = null;
  if (args.ownerEmail) {
    ownerEmail = args.ownerEmail;
  } else if (args.ownerKaliId) {
    const resolved = staffEmail(seed, args.ownerKaliId);
    if (resolved === null) return { count: 0, events: [] };
    ownerEmail = resolved;
  }

  const out: M365CalendarEvent[] = [];
  for (const e of seed.calendars) {
    if (ownerEmail && e.organizer.emailAddress.address !== ownerEmail) continue;
    if (args.startDate && e.start.dateTime < args.startDate) continue;
    if (args.endDate && e.start.dateTime > args.endDate) continue;
    if (
      args.subjectContains &&
      !e.subject.toLowerCase().includes(args.subjectContains.toLowerCase())
    )
      continue;
    out.push(e);
  }
  return { count: out.length, events: out.slice(0, limit) };
}

export function getDistributionLists(seed: M365Seed) {
  return seed.distributionLists;
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const makeTool = makeToolFactory<M365Seed>("m365", getM365Seed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "m365.getUser",
    description:
      "Get an M365 staff user by kali_entity_id. Returns null for non-staff or unknown id.",
    domain: "comms",
    input: z.object({ kali_entity_id: z.string() }),
    output: m365UserSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getUser(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "m365.searchUsers",
    description:
      "Search the M365 staff directory by department, job-title substring, or name substring.",
    domain: "comms",
    input: z.object({
      department: z.string().optional(),
      jobTitleContains: z.string().optional(),
      nameContains: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      users: z.array(m365UserSchema),
    }),
    collectRecordIds: (out) => out.users.map((u) => u.kali_entity_id),
    run: (seed, input) => searchUsers(seed, input),
  }),

  makeTool({
    name: "m365.searchEmails",
    description:
      "Search M365 messages. Filter by subject substring, body-preview substring, sender (email or kali_entity_id of staff), recipient email, date range, attachment flag, or conversationId. Returns metadata + bodyPreview only (full bodies not exposed in v1 for privacy).",
    domain: "comms",
    input: z.object({
      subjectContains: z.string().optional(),
      bodyContains: z.string().optional(),
      fromEmail: z.string().optional(),
      fromKaliId: z.string().optional(),
      recipientEmail: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      hasAttachments: z.boolean().optional(),
      conversationId: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      messages: z.array(m365MessageSchema),
    }),
    collectRecordIds: (out) => out.messages.map((m) => m.kali_entity_id),
    run: (seed, input) => searchEmails(seed, input),
  }),

  makeTool({
    name: "m365.getEmailThread",
    description:
      "Get every message in a conversation, ordered oldest → newest, by conversationId.",
    domain: "comms",
    input: z.object({ conversationId: z.string() }),
    output: z.object({
      conversationId: z.string(),
      count: z.number().int().nonnegative(),
      messages: z.array(m365MessageSchema),
    }),
    collectRecordIds: (out) => out.messages.map((m) => m.kali_entity_id),
    run: (seed, input) => getEmailThread(seed, input.conversationId),
  }),

  makeTool({
    name: "m365.getLastEmailToEmail",
    description:
      "Get the most recent message sent to a given email address. Useful for 'when did we last contact this donor'.",
    domain: "comms",
    input: z.object({ recipientEmail: z.string() }),
    output: m365MessageSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getLastEmailToEmail(seed, input.recipientEmail),
  }),

  makeTool({
    name: "m365.getCalendarEvents",
    description:
      "Search calendar events. Filter by owner (email or staff kali_entity_id), date range, and subject substring.",
    domain: "comms",
    input: z.object({
      ownerEmail: z.string().optional(),
      ownerKaliId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      subjectContains: z.string().optional(),
      limit: z.number().int().positive().max(1_000).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      events: z.array(m365CalendarEventSchema),
    }),
    collectRecordIds: (out) => out.events.map((e) => e.kali_entity_id),
    run: (seed, input) => getCalendarEvents(seed, input),
  }),

  makeTool({
    name: "m365.getDistributionLists",
    description: "List internal email distribution lists with member counts.",
    domain: "comms",
    input: z.object({}),
    output: z.array(m365DistributionListSchema),
    collectRecordIds: () => [],
    run: (seed) => getDistributionLists(seed),
  }),
];

export const m365: Connector = {
  id: "m365",
  label: "Microsoft 365",
  domain: "comms",
  tools,
  init: async () => {
    await getM365Seed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(m365);
  registered = true;
}

ensureRegistered();
