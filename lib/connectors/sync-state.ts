/**
 * Sync-state tracker for connectors.
 *
 * Records per-connector status + last-sync timestamp + record count + the
 * last error (if any). The chat UI's source-pulse panel hits this through
 * the GET /api/connectors/status endpoint to render "Connected • last
 * synced 2h ago" / "Error" / "Syncing…" badges.
 *
 * v1 backing store is in-memory (a Map). Production migrates to the
 * Drizzle `connectors.sync_state` jsonb column.
 */

import type { ConnectorId } from "./base";

export type SyncStatus =
  | "never"
  | "syncing"
  | "connected"
  | "error";

export interface SyncStateEntry {
  connectorId: ConnectorId;
  label: string;
  status: SyncStatus;
  lastSyncAt: string | null;
  /** Last successful sync — useful even when current status is `error`. */
  lastSuccessAt: string | null;
  recordCount?: number;
  /** Last error message; only meaningful when status === "error". */
  lastError?: string;
}

const __byId = new Map<ConnectorId, SyncStateEntry>();

export function ensureEntry(
  connectorId: ConnectorId,
  label: string,
): SyncStateEntry {
  let e = __byId.get(connectorId);
  if (!e) {
    e = {
      connectorId,
      label,
      status: "never",
      lastSyncAt: null,
      lastSuccessAt: null,
    };
    __byId.set(connectorId, e);
  } else if (e.label !== label) {
    e.label = label;
  }
  return e;
}

export function markSyncing(connectorId: ConnectorId, label: string): void {
  const e = ensureEntry(connectorId, label);
  e.status = "syncing";
  e.lastError = undefined;
}

export function markSynced(
  connectorId: ConnectorId,
  label: string,
  opts: { recordCount?: number } = {},
): void {
  const e = ensureEntry(connectorId, label);
  const now = new Date().toISOString();
  e.status = "connected";
  e.lastSyncAt = now;
  e.lastSuccessAt = now;
  if (opts.recordCount !== undefined) e.recordCount = opts.recordCount;
  e.lastError = undefined;
}

export function markError(
  connectorId: ConnectorId,
  label: string,
  message: string,
): void {
  const e = ensureEntry(connectorId, label);
  e.status = "error";
  e.lastSyncAt = new Date().toISOString();
  e.lastError = message;
}

export function getSyncState(connectorId: ConnectorId): SyncStateEntry | null {
  return __byId.get(connectorId) ?? null;
}

export function listSyncStates(): SyncStateEntry[] {
  return Array.from(__byId.values()).sort((a, b) =>
    a.connectorId.localeCompare(b.connectorId),
  );
}

/** Test/dev-only: drop every tracked entry. */
export function __resetSyncStates(): void {
  __byId.clear();
}

/** Snapshot count for tests. */
export function __syncStateSize(): number {
  return __byId.size;
}

/**
 * Wrap a connector's init() so it updates sync state automatically.
 * Idempotent — re-running keeps marking `connected`. Errors mark `error`
 * and rethrow.
 */
export async function trackInit(
  connectorId: ConnectorId,
  label: string,
  init: () => Promise<void> | void,
  opts: { recordCount?: () => number | Promise<number> } = {},
): Promise<void> {
  markSyncing(connectorId, label);
  try {
    await init();
    const recordCount = opts.recordCount ? await opts.recordCount() : undefined;
    markSynced(connectorId, label, { recordCount });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    markError(connectorId, label, msg);
    throw e;
  }
}

/**
 * Initialize every registered connector and record sync state for each.
 * The runtime calls this once at boot so the source-pulse panel has data
 * to render before the first user message arrives.
 */
export async function initAllAndTrack(
  connectors: { id: ConnectorId; label: string; init?: () => Promise<void> }[],
): Promise<SyncStateEntry[]> {
  for (const c of connectors) {
    if (!c.init) {
      // No init = trivially "connected" (nothing to set up).
      markSynced(c.id, c.label);
      continue;
    }
    try {
      await trackInit(c.id, c.label, c.init);
    } catch {
      // Already recorded as error; keep going so one bad connector doesn't
      // stall the whole boot.
    }
  }
  return listSyncStates();
}
