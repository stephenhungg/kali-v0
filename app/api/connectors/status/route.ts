/**
 * GET /api/connectors/status
 *
 * Returns sync state for every registered connector. Powers the chat UI's
 * source-pulse panel (the 11+ tiles on the right) — each tile renders
 * `connected` / `syncing` / `error` / `never` with last-sync timestamp +
 * record count + (when present) lastError.
 *
 * Side effect: on cold start, initializes every connector's seed via
 * `initAllAndTrack` so the response carries fresh state.
 */

import { NextResponse } from "next/server";
import { listConnectors } from "@/lib/connectors/registry";
import {
  initAllAndTrack,
  listSyncStates,
} from "@/lib/connectors/sync-state";
import "@/lib/agent/registrations";

export const runtime = "nodejs";

let __initPromise: Promise<unknown> | null = null;

async function ensureInited() {
  if (!__initPromise) {
    __initPromise = initAllAndTrack(
      listConnectors().map((c) => ({
        id: c.id,
        label: c.label,
        init: c.init,
      })),
    );
  }
  return __initPromise;
}

export async function GET() {
  await ensureInited();
  return NextResponse.json({
    connectors: listSyncStates(),
    summary: {
      total: listConnectors().length,
      connected: listSyncStates().filter((s) => s.status === "connected").length,
      error: listSyncStates().filter((s) => s.status === "error").length,
    },
  });
}
