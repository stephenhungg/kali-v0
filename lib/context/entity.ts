/**
 * The "context" meta-connector — exposes cross-source entity tools to the
 * agent: `context.resolveEntity` (free-text → kali_entity_id matches) and
 * `context.entityProfile` (kali_entity_id → unified dossier across every
 * connector). One call instead of N — the agent uses these to ground a
 * query in a single canonical entity before chaining tool calls.
 */

import { z } from "zod";
import type { Connector, ToolContext, ToolDefinition } from "../connectors/base";
import { registerConnector } from "../connectors/registry";
import { hashParams } from "../connectors/test-helpers";
import {
  entityProfile,
  resolveEntity,
  type EntityProfile,
  type ResolverHit,
} from "./entityResolver";
import { semanticSearch } from "./semanticSearch";
import { indexAll } from "./indexer";

const resolverHitSchema = z.object({
  kali_entity_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  source: z.enum(["bloomerang", "salesforce", "m365", "zoom"]),
  confidence: z.number().min(0).max(100),
  matchedOn: z.string(),
});

const entityProfileSchema = z.object({
  kali_entity_id: z.string(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  presentIn: z.array(z.enum(["bloomerang", "salesforce", "m365", "zoom"])),
  bloomerang: z
    .object({
      segment: z.string().nullable(),
      lifetimeGiving: z.number().nullable(),
      lastGiftDate: z.string().nullable(),
      engagementLevel: z.string().nullable(),
    })
    .nullable(),
  salesforce: z
    .object({
      isBoard: z.boolean(),
      isMajorDonor: z.boolean(),
      title: z.string().nullable(),
      employerName: z.string().nullable(),
      lifetimeGiving: z.number().nullable(),
      totalGifts: z.number().nullable(),
    })
    .nullable(),
  m365: z
    .object({
      department: z.string().nullable(),
      jobTitle: z.string().nullable(),
    })
    .nullable(),
  zoom: z
    .object({
      meetingCount: z.number().int().nonnegative(),
      recentMeetings: z.array(
        z.object({
          kali_entity_id: z.string(),
          topic: z.string(),
          startTime: z.string(),
        }),
      ),
    })
    .nullable(),
});

/**
 * Inline ToolDefinition factory (the standard `_tool-factory.ts` is keyed on
 * a single connector seed; the context tools span every connector seed and
 * have no single seed handle, so we build the handlers manually here).
 */
function makeContextTool<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(spec: {
  name: string;
  description: string;
  domain: ToolDefinition["domain"];
  input: TInput;
  output: TOutput;
  collectRecordIds?: (out: z.infer<TOutput>) => string[];
  run: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}): ToolDefinition<TInput, TOutput> {
  return {
    name: spec.name,
    description: spec.description,
    domain: spec.domain,
    input: spec.input,
    output: spec.output,
    handler: async (input, ctx: ToolContext) => {
      const t0 = Date.now();
      const result = await spec.run(input);
      const recordIds = spec.collectRecordIds ? spec.collectRecordIds(result) : [];
      await ctx.audit({
        source: "context",
        toolName: spec.name,
        paramsHash: hashParams(input),
        recordIds,
        durationMs: Date.now() - t0,
      });
      return result;
    },
  };
}

const tools: ToolDefinition[] = [
  makeContextTool({
    name: "context.resolveEntity",
    description:
      "Find candidate kali_entity_ids for a free-text query (name, email, or phone) across Bloomerang, Salesforce, M365, and Zoom. Returns matches sorted by confidence (0–100). Email match is highest (100); phone match (90); exact name (80); name substring with corroborating attribute (60); name substring alone (40). Use this BEFORE chaining other tools when the user named a person you don't yet have a kali_entity_id for.",
    domain: "donor",
    input: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
    output: z.object({
      count: z.number().int().nonnegative(),
      hits: z.array(resolverHitSchema),
    }),
    collectRecordIds: (out) => out.hits.map((h: ResolverHit) => h.kali_entity_id),
    run: async (input) => resolveEntity(input),
  }),

  makeContextTool({
    name: "context.entityProfile",
    description:
      "Aggregate everything we know about one entity (kali_entity_id) across every connector — Bloomerang giving, Salesforce contact + employer, M365 department + title, Zoom meeting attendance. ONE call instead of N tool chains. Use this when the user wants a quick 360 on a person.",
    domain: "donor",
    input: z.object({ kali_entity_id: z.string() }),
    output: entityProfileSchema.nullable(),
    collectRecordIds: (out) =>
      out ? [(out as EntityProfile).kali_entity_id] : [],
    run: async (input) => entityProfile(input.kali_entity_id),
  }),

  makeContextTool({
    name: "context.semanticSearch",
    description:
      "Hybrid semantic + structured retrieval across every connector's text content (zoom transcripts, sharepoint document bodies, m365 email subjects/snippets, instrumentl grant notes, bloomerang donor summaries, powerbi tile titles, powerautomate flow descriptions). Returns top-K matches sorted by cosine similarity, with source + sourceRecordId + chunk text. Filter by `sources` (list of connector ids), a specific `kali_entity_id`, or `metaEq` key/value pairs. Use this for vague-natured questions like 'what's the youth mentorship cohort sentiment from board meetings' that span multiple sources.",
    domain: "donor",
    input: z.object({
      query: z.string().min(1),
      sources: z
        .array(
          z.enum([
            "bloomerang",
            "salesforce",
            "m365",
            "zoom",
            "sharepoint",
            "instrumentl",
            "quickbooks",
            "solana",
            "powerbi",
            "powerautomate",
            "knowbe4",
            "context",
          ]),
        )
        .optional(),
      kali_entity_id: z.string().optional(),
      metaEq: z.record(z.string(), z.unknown()).optional(),
      limit: z.number().int().positive().max(50).optional(),
      minScore: z.number().min(-1).max(1).optional(),
    }),
    output: z.object({
      query: z.string(),
      embedder: z.string(),
      totalCandidates: z.number().int().nonnegative(),
      count: z.number().int().nonnegative(),
      hits: z.array(
        z.object({
          id: z.string(),
          score: z.number(),
          source: z.string(),
          sourceRecordId: z.string(),
          kali_entity_id: z.string().optional(),
          text: z.string(),
          chunkIndex: z.number().int().nonnegative(),
          meta: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
    collectRecordIds: (out) => out.hits.map((h) => h.sourceRecordId),
    run: async (input) => semanticSearch(input),
  }),

  makeContextTool({
    name: "context.rebuildIndex",
    description:
      "Force a rebuild of the semantic search index over every connector's text content. Use after seed regeneration or when sources have changed. Returns chunk counts per source.",
    domain: "donor",
    input: z.object({
      namespace: z.string().optional(),
    }),
    output: z.object({
      namespace: z.string(),
      embedder: z.string(),
      embedderDim: z.number().int().positive(),
      chunksBySource: z.record(z.string(), z.number()),
      total: z.number().int().nonnegative(),
      durationMs: z.number().nonnegative(),
    }),
    collectRecordIds: () => [],
    run: async (input) => indexAll({ namespace: input.namespace }),
  }),
];

export const context: Connector = {
  id: "context",
  label: "Context (cross-source)",
  domain: "donor",
  tools,
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(context);
  registered = true;
}

ensureRegistered();
