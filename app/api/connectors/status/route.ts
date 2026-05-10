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

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listConnectors } from "@/lib/connectors/registry";
import {
  initAllAndTrack,
  listSyncStates,
} from "@/lib/connectors/sync-state";
import "@/lib/agent/registrations";
import { getOnboardingState } from "@/lib/supabase/server";

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
  const all = listSyncStates();

  // Resolve tenant's selected connectors (if any). Demo escape: cookie
  // `kali_demo_mode=rivertown` skips filtering and shows everything.
  const cookieJar = await cookies();
  const demoMode = cookieJar.get("kali_demo_mode")?.value === "rivertown";
  let selected: string[] | null = null;

  const supaConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (supaConfigured && !demoMode) {
    try {
      const { state } = await getOnboardingState();
      if (state?.selectedConnectors && state.selectedConnectors.length > 0) {
        selected = state.selectedConnectors;
      }
    } catch {
      // unauthenticated or env mis-set — return all (the chat / dashboard
      // routes will redirect to /onboarding anyway).
    }
  }

  const filtered = selected
    ? all.filter(s => selected!.includes(s.connectorId))
    : all;

  return NextResponse.json({
    connectors: filtered,
    summary: {
      total: filtered.length,
      connected: filtered.filter((s) => s.status === "connected").length,
      error: filtered.filter((s) => s.status === "error").length,
    },
  });
}
