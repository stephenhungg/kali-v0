/**
 * In-memory vector store with per-tenant namespacing.
 *
 * Each entry carries:
 *   - namespace (tenantId)
 *   - kali_entity_id  (link back to canonical graph)
 *   - source (ConnectorId — bloomerang, sharepoint, zoom, ...)
 *   - sourceRecordId (the record's native id; transcript, doc, email...)
 *   - chunkIndex (when one record is chunked into multiple vectors)
 *   - text (the raw chunk that was embedded — for snippet display)
 *   - meta (free-form key/value the caller can filter on)
 *   - vector (Float32Array, L2-normalized → cosine sim is a dot product)
 *
 * v1 stores in a Map. Production migrates to pgvector with the same shape
 * (`record_id`, `vector`, `metadata` columns — see `lib/db/schema.ts`
 * embeddings table).
 */

import type { ConnectorId } from "../connectors/base";
import { cosineSim } from "./embed";

export interface VectorEntry {
  id: string;
  namespace: string;
  kali_entity_id?: string;
  source: ConnectorId;
  sourceRecordId: string;
  chunkIndex: number;
  text: string;
  meta?: Record<string, unknown>;
  vector: Float32Array;
}

export interface SearchHit {
  id: string;
  score: number;
  source: ConnectorId;
  sourceRecordId: string;
  kali_entity_id?: string;
  text: string;
  chunkIndex: number;
  meta?: Record<string, unknown>;
}

export interface SearchOptions {
  /** Required cosine-sim threshold (default 0). */
  minScore?: number;
  /** Top-K cap. Default 20. Hard-capped at 200. */
  limit?: number;
  /** Restrict to specific connector sources. */
  sources?: ConnectorId[];
  /** Restrict to a specific kali_entity_id (e.g. one donor). */
  kali_entity_id?: string;
  /** Generic equality predicate over `entry.meta`. */
  metaEq?: Record<string, unknown>;
}

let __seq = 0;
function nextId(): string {
  __seq++;
  return `vec_${Date.now().toString(36)}_${__seq.toString(36)}`;
}

const __byNamespace = new Map<string, VectorEntry[]>();

function ensureNs(namespace: string): VectorEntry[] {
  let arr = __byNamespace.get(namespace);
  if (!arr) {
    arr = [];
    __byNamespace.set(namespace, arr);
  }
  return arr;
}

export function upsert(entry: Omit<VectorEntry, "id"> & { id?: string }): VectorEntry {
  const arr = ensureNs(entry.namespace);
  const id = entry.id ?? nextId();
  // Replace if same source+sourceRecordId+chunkIndex already exists.
  const idx = arr.findIndex(
    (e) =>
      e.source === entry.source &&
      e.sourceRecordId === entry.sourceRecordId &&
      e.chunkIndex === entry.chunkIndex,
  );
  const finalEntry: VectorEntry = { ...entry, id };
  if (idx >= 0) arr[idx] = finalEntry;
  else arr.push(finalEntry);
  return finalEntry;
}

export function upsertMany(
  entries: Array<Omit<VectorEntry, "id"> & { id?: string }>,
): VectorEntry[] {
  return entries.map((e) => upsert(e));
}

export function size(namespace: string): number {
  return __byNamespace.get(namespace)?.length ?? 0;
}

export function totalSize(): number {
  let n = 0;
  for (const arr of __byNamespace.values()) n += arr.length;
  return n;
}

export function listNamespaces(): string[] {
  return Array.from(__byNamespace.keys()).sort();
}

export function clear(namespace: string): void {
  __byNamespace.delete(namespace);
}

export function __resetVectorStore(): void {
  __byNamespace.clear();
}

/**
 * Top-K cosine search against the namespace. Pre-filters by source /
 * kali_entity_id / metaEq before scoring (so the score is computed only
 * on candidates that pass structured filters).
 */
export function search(
  namespace: string,
  query: Float32Array,
  options: SearchOptions = {},
): SearchHit[] {
  const candidates = __byNamespace.get(namespace) ?? [];
  const limit = Math.min(options.limit ?? 20, 200);
  const minScore = options.minScore ?? 0;

  const filtered = candidates.filter((e) => {
    if (options.sources && !options.sources.includes(e.source)) return false;
    if (options.kali_entity_id && e.kali_entity_id !== options.kali_entity_id)
      return false;
    if (options.metaEq) {
      for (const [k, v] of Object.entries(options.metaEq)) {
        if ((e.meta ?? {})[k] !== v) return false;
      }
    }
    return true;
  });

  const scored: SearchHit[] = [];
  for (const e of filtered) {
    const score = cosineSim(query, e.vector);
    if (score < minScore) continue;
    scored.push({
      id: e.id,
      score,
      source: e.source,
      sourceRecordId: e.sourceRecordId,
      kali_entity_id: e.kali_entity_id,
      text: e.text,
      chunkIndex: e.chunkIndex,
      meta: e.meta,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
