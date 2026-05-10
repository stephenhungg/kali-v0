/**
 * SharePoint connector — file & document management.
 *
 * Powers cross-tool reasoning over policies, board minutes, program reports,
 * grant applications, financial statements, HR records, communication plans,
 * and annual reports. The agent uses this to ground claims in real documents
 * (e.g. "two recent program reports flag at-risk youth mentorship cohorts").
 *
 * Real-OAuth path: Microsoft Graph (Sites.Read.All, Files.Read.All) with
 * admin consent. Most complex auth flow of the eleven. ~3 weeks.
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import { loadSeed, type SeedSize } from "./seed-loader";
import { makeToolFactory } from "./_tool-factory";
import {
  sharepointDocTypeSchema,
  sharepointFileSchema,
  sharepointSeedSchema,
  sharepointSiteSchema,
  type SharepointDocType,
  type SharepointFile,
  type SharepointSeed,
} from "./sharepoint.schema";

/* ─── seed access ─────────────────────────────────────────────────────── */

let seedPromise: Promise<SharepointSeed> | null = null;

export async function getSharepointSeed(size?: SeedSize): Promise<SharepointSeed> {
  if (!seedPromise) {
    seedPromise = loadSeed("sharepoint", sharepointSeedSchema, size ? { size } : {});
  }
  return seedPromise;
}

export function __resetSharepointSeedForTest(): void {
  seedPromise = null;
}

/* ─── pure queries ────────────────────────────────────────────────────── */

const SEARCH_LIMIT = 20;

export interface FileSummary {
  kali_entity_id: string;
  name: string;
  type: SharepointDocType;
  siteId: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  sizeBytes: number;
  tags: string[];
  snippet: string;
  createdBy: string | null;
  relatedGrant: string | null;
  relatedProgram: string | null;
}

function snippetFor(body: string, query: string | undefined, length = 280): string {
  if (!query) return body.slice(0, length) + (body.length > length ? "…" : "");
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, length) + (body.length > length ? "…" : "");
  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + query.length + 200);
  return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
}

function toFileSummary(f: SharepointFile, query?: string): FileSummary {
  return {
    kali_entity_id: f.kali_entity_id,
    name: f.name,
    type: f.type,
    siteId: f.siteId,
    createdDateTime: f.createdDateTime,
    lastModifiedDateTime: f.lastModifiedDateTime,
    sizeBytes: f.sizeBytes,
    tags: f.tags,
    snippet: snippetFor(f.body, query),
    createdBy: f.createdBy ?? null,
    relatedGrant: f.relatedGrant ?? null,
    relatedProgram: f.relatedProgram ?? null,
  };
}

export interface SearchDocumentsArgs {
  query?: string;
  type?: SharepointDocType;
  siteId?: string;
  tag?: string;
  programKaliId?: string;
  grantKaliId?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  limit?: number;
}

export function searchDocuments(
  seed: SharepointSeed,
  args: SearchDocumentsArgs,
): { count: number; files: FileSummary[] } {
  const limit = Math.min(args.limit ?? SEARCH_LIMIT, 200);
  const q = args.query?.toLowerCase();
  const out: SharepointFile[] = [];
  for (const f of seed.files) {
    if (args.type && f.type !== args.type) continue;
    if (args.siteId && f.siteId !== args.siteId) continue;
    if (args.tag && !f.tags.includes(args.tag)) continue;
    if (args.programKaliId && f.relatedProgram !== args.programKaliId) continue;
    if (args.grantKaliId && f.relatedGrant !== args.grantKaliId) continue;
    if (args.modifiedAfter && f.lastModifiedDateTime < args.modifiedAfter) continue;
    if (args.modifiedBefore && f.lastModifiedDateTime > args.modifiedBefore) continue;
    if (q) {
      const inName = f.name.toLowerCase().includes(q);
      const inBody = f.body.toLowerCase().includes(q);
      const inTag = f.tags.some((t) => t.toLowerCase().includes(q));
      if (!inName && !inBody && !inTag) continue;
    }
    out.push(f);
  }
  return { count: out.length, files: out.slice(0, limit).map((f) => toFileSummary(f, args.query)) };
}

export function getDocument(
  seed: SharepointSeed,
  kaliEntityId: string,
): SharepointFile | null {
  return seed.files.find((f) => f.kali_entity_id === kaliEntityId) ?? null;
}

export function getRecentDocuments(
  seed: SharepointSeed,
  args: { days: number; limit?: number },
  now: number = Date.now(),
): { count: number; files: FileSummary[] } {
  const cutoff = new Date(now - args.days * 86_400_000).toISOString().slice(0, 10);
  return searchDocuments(seed, { modifiedAfter: cutoff, limit: args.limit });
}

export function getDocumentsByTag(
  seed: SharepointSeed,
  args: { tag: string; limit?: number },
): { count: number; files: FileSummary[] } {
  return searchDocuments(seed, { tag: args.tag, limit: args.limit });
}

export function getSharedWithExternalUsers(
  seed: SharepointSeed,
  args: { limit?: number } = {},
): {
  count: number;
  files: (FileSummary & { sharingLinks: string[] })[];
} {
  const limit = Math.min(args.limit ?? 50, 200);
  const matching = seed.files.filter((f) => f.sharingLinks.length > 0);
  return {
    count: matching.length,
    files: matching.slice(0, limit).map((f) => ({
      ...toFileSummary(f),
      sharingLinks: f.sharingLinks,
    })),
  };
}

export function listSites(seed: SharepointSeed) {
  return seed.sites;
}

/* ─── tool definitions ────────────────────────────────────────────────── */

const fileSummarySchema = z.object({
  kali_entity_id: z.string(),
  name: z.string(),
  type: sharepointDocTypeSchema,
  siteId: z.string(),
  createdDateTime: z.string(),
  lastModifiedDateTime: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  snippet: z.string(),
  createdBy: z.string().nullable(),
  relatedGrant: z.string().nullable(),
  relatedProgram: z.string().nullable(),
});

const fileListSchema = z.object({
  count: z.number().int().nonnegative(),
  files: z.array(fileSummarySchema),
});

const externalShareSchema = z.object({
  count: z.number().int().nonnegative(),
  files: z.array(fileSummarySchema.extend({ sharingLinks: z.array(z.string()) })),
});

const makeTool = makeToolFactory<SharepointSeed>("sharepoint", getSharepointSeed);

const tools: ToolDefinition[] = [
  makeTool({
    name: "sharepoint.searchDocuments",
    description:
      "Search SharePoint documents. Filter by free-text query (matches name, body, tags), document type (board_minutes | program_report | grant_application | financial_statement | policy | hr_record | communication_plan | annual_report), siteId, single tag, related program (kali_entity_id), related grant (kali_entity_id), and modified-date range. Returns summaries with query-aware snippets.",
    domain: "programs",
    input: z.object({
      query: z.string().optional(),
      type: sharepointDocTypeSchema.optional(),
      siteId: z.string().optional(),
      tag: z.string().optional(),
      programKaliId: z.string().optional(),
      grantKaliId: z.string().optional(),
      modifiedAfter: z.string().optional(),
      modifiedBefore: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: fileListSchema,
    collectRecordIds: (out) => out.files.map((f) => f.kali_entity_id),
    run: (seed, input) => searchDocuments(seed, input),
  }),

  makeTool({
    name: "sharepoint.getDocument",
    description:
      "Get a SharePoint document's full record (including full body) by kali_entity_id.",
    domain: "programs",
    input: z.object({ kali_entity_id: z.string() }),
    output: sharepointFileSchema.nullable(),
    collectRecordIds: (out) => (out ? [out.kali_entity_id] : []),
    run: (seed, input) => getDocument(seed, input.kali_entity_id),
  }),

  makeTool({
    name: "sharepoint.getRecentDocuments",
    description: "Documents modified in the last N days. Returns query-aware summaries.",
    domain: "programs",
    input: z.object({
      days: z.number().int().positive().max(3650),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: fileListSchema,
    collectRecordIds: (out) => out.files.map((f) => f.kali_entity_id),
    run: (seed, input) => getRecentDocuments(seed, input),
  }),

  makeTool({
    name: "sharepoint.getDocumentsByTag",
    description:
      "Documents carrying a specific tag (confidential, draft, approved, fy2024, fy2025, fy2026, pending-review, archived, shared, …).",
    domain: "programs",
    input: z.object({
      tag: z.string(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    output: fileListSchema,
    collectRecordIds: (out) => out.files.map((f) => f.kali_entity_id),
    run: (seed, input) => getDocumentsByTag(seed, input),
  }),

  makeTool({
    name: "sharepoint.getSharedWithExternalUsers",
    description:
      "Audit: list documents that have an active external sharing link. Useful for security/compliance reviews.",
    domain: "security",
    input: z.object({ limit: z.number().int().positive().max(200).optional() }),
    output: externalShareSchema,
    collectRecordIds: (out) => out.files.map((f) => f.kali_entity_id),
    run: (seed, input) => getSharedWithExternalUsers(seed, input),
  }),

  makeTool({
    name: "sharepoint.listSites",
    description: "List configured SharePoint sites (Internal, Board, Grants, Programs, Finance).",
    domain: "programs",
    input: z.object({}),
    output: z.array(sharepointSiteSchema),
    collectRecordIds: () => [],
    run: (seed) => listSites(seed),
  }),
];

export const sharepoint: Connector = {
  id: "sharepoint",
  label: "SharePoint",
  domain: "programs",
  tools,
  init: async () => {
    await getSharepointSeed();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(sharepoint);
  registered = true;
}

ensureRegistered();
