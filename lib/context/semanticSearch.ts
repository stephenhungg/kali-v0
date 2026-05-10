/**
 * Hybrid semantic + structured retrieval.
 *
 * Pulls the embedder, embeds the query, runs a top-K cosine search inside
 * the per-tenant namespace with structured pre-filters (sources, kali
 * entity, meta equality). Returns hits with text snippets + source
 * references the agent can cite.
 *
 * Lazily indexes on first call so callers don't have to bootstrap. Set
 * `forceReindex` to rebuild (e.g. after seed regeneration).
 */

import type { ConnectorId } from "../connectors/base";
import { getEmbedder } from "./embed";
import { indexAll } from "./indexer";
import { search, size, type SearchHit } from "./vectorStore";

const __indexed = new Set<string>();

export interface SemanticSearchArgs {
  query: string;
  /** Tenant namespace. Default "rivertown". */
  namespace?: string;
  /** Restrict to a subset of connectors. */
  sources?: ConnectorId[];
  /** Restrict to one entity. */
  kali_entity_id?: string;
  /** Equality filter against the `meta` blob each chunk carries. */
  metaEq?: Record<string, unknown>;
  /** Top-K cap. Default 10. */
  limit?: number;
  /** Cosine-sim floor. Default 0 (return everything ranked). */
  minScore?: number;
  /** Force a re-index even if this namespace was already indexed. */
  forceReindex?: boolean;
}

export interface SemanticSearchResult {
  query: string;
  embedder: string;
  totalCandidates: number;
  count: number;
  hits: Array<
    Pick<
      SearchHit,
      | "id"
      | "score"
      | "source"
      | "sourceRecordId"
      | "kali_entity_id"
      | "text"
      | "chunkIndex"
      | "meta"
    >
  >;
}

async function ensureIndexed(
  namespace: string,
  forceReindex: boolean,
): Promise<void> {
  if (!forceReindex && __indexed.has(namespace) && size(namespace) > 0) return;
  await indexAll({ namespace });
  __indexed.add(namespace);
}

export async function semanticSearch(
  args: SemanticSearchArgs,
): Promise<SemanticSearchResult> {
  const namespace = args.namespace ?? "rivertown";
  await ensureIndexed(namespace, !!args.forceReindex);

  const embedder = getEmbedder();
  const queryVec = await embedder.embed(args.query);
  const hits = search(namespace, queryVec, {
    sources: args.sources,
    kali_entity_id: args.kali_entity_id,
    metaEq: args.metaEq,
    limit: args.limit ?? 10,
    minScore: args.minScore ?? 0,
  });

  return {
    query: args.query,
    embedder: embedder.model,
    totalCandidates: size(namespace),
    count: hits.length,
    hits: hits.map((h) => ({
      id: h.id,
      score: h.score,
      source: h.source,
      sourceRecordId: h.sourceRecordId,
      kali_entity_id: h.kali_entity_id,
      text: h.text,
      chunkIndex: h.chunkIndex,
      meta: h.meta,
    })),
  };
}

/** Test/dev-only: reset the "is this namespace indexed?" cache. */
export function __resetIndexedCache(): void {
  __indexed.clear();
}
