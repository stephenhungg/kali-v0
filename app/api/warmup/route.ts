/**
 * POST /api/warmup
 *
 * Pre-warm the backend: load every connector seed, build the semantic
 * search index, surface sync state. Returns timings + counts so the UI
 * can show a progress badge.
 *
 * The first chat call in a fresh process otherwise pays:
 *   ~50ms loading 11 connector seeds
 *   ~5–10s building the embedding index (depends on embedder + corpus)
 *
 * Calling /api/warmup early — e.g. from a `useEffect` on the chat page —
 * shifts that latency off the first user turn.
 *
 * GET is also accepted for convenience (cron tickers, manual smoke).
 */

import { NextResponse } from "next/server";
import { listConnectors } from "@/lib/connectors/registry";
import {
  initAllAndTrack,
  listSyncStates,
} from "@/lib/connectors/sync-state";
import { indexAll } from "@/lib/context/indexer";
import "@/lib/agent/registrations";

export const runtime = "nodejs";

let __warmPromise: Promise<{
  durationMs: number;
  connectorInitMs: number;
  indexMs: number;
  embedder: string;
  embedderDim: number;
  totalChunks: number;
  chunksBySource: Record<string, number>;
  connectors: ReturnType<typeof listSyncStates>;
}> | null = null;

async function warm() {
  const t0 = Date.now();

  const tInit0 = Date.now();
  await initAllAndTrack(
    listConnectors().map((c) => ({
      id: c.id,
      label: c.label,
      init: c.init,
    })),
  );
  const connectorInitMs = Date.now() - tInit0;

  const tIdx0 = Date.now();
  const idx = await indexAll();
  const indexMs = Date.now() - tIdx0;

  return {
    durationMs: Date.now() - t0,
    connectorInitMs,
    indexMs,
    embedder: idx.embedder,
    embedderDim: idx.embedderDim,
    totalChunks: idx.total,
    chunksBySource: idx.chunksBySource,
    connectors: listSyncStates(),
  };
}

async function ensureWarm() {
  if (!__warmPromise) {
    __warmPromise = warm();
  }
  return __warmPromise;
}

export async function POST() {
  const result = await ensureWarm();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await ensureWarm();
  return NextResponse.json(result);
}
