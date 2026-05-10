"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CONNECTOR_DISPLAYS,
  findDisplay,
  formatRelative,
  type ConnectorVisualStatus,
  type ConnectorDisplay,
} from "../../lib/connectors/status";

interface PulseState {
  activeUntil: Record<string, number>;
  callCount: Record<string, number>;
}

interface BackendSyncEntry {
  connectorId: string;
  label: string;
  status: "never" | "syncing" | "connected" | "error";
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  recordCount?: number;
  lastError?: string;
}

interface BackendStatusResponse {
  connectors: BackendSyncEntry[];
  summary: { total: number; connected: number; error: number };
}

interface ConnectorMenuProps {
  pulse: PulseState;
  onOpenConnector: (id: string) => void;
}

interface MergedTile extends ConnectorDisplay {
  status: ConnectorVisualStatus;
  recordCount: number | null;
  lastSyncedAt: string | null;
  lastError?: string;
}

export function ConnectorMenu({ pulse, onOpenConnector }: ConnectorMenuProps) {
  const [backend, setBackend] = useState<BackendStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/connectors/status")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: BackendStatusResponse) => { if (alive) { setBackend(data); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const tiles: MergedTile[] = useMemo(() => merge(backend), [backend]);
  const connected = backend?.summary.connected ?? 0;
  const total = backend?.summary.total ?? 0;

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--mint-line)] bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--mint-line)] bg-[var(--surface)] px-4 py-3">
        <h2 className="r-display text-[18px] font-medium tracking-tight text-[var(--matcha-deep)]">Sources</h2>
        <p className="mt-1 text-[11px] leading-snug text-[var(--gray-ink)]">
          {loading ? "loading…" : (total > 0 ? `${connected} / ${total} connected` : "Connected SaaS systems Kali reasons across.")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="px-4 py-3 text-[12px] text-[var(--gray-ink)]">loading…</div>
        ) : (
          <ul className="space-y-1 px-2">
            {tiles.map(t => (
              <ConnectorTile
                key={t.id}
                tile={t}
                isPulsing={!!pulse.activeUntil[t.id] && pulse.activeUntil[t.id] > Date.now()}
                callCount={pulse.callCount[t.id] ?? 0}
                onOpen={onOpenConnector}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--mint-line)] bg-[var(--surface)] px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenConnector("mailchimp")}
          className="w-full rounded border border-dashed border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--matcha-deep)] transition-colors hover:bg-[var(--mint-pale)]"
        >
          + add another source
        </button>
      </div>
    </aside>
  );
}

function merge(backend: BackendStatusResponse | null): MergedTile[] {
  const out: MergedTile[] = [];
  const seen = new Set<string>();

  // First pass: every backend connector, mapped through display config.
  if (backend) {
    for (const entry of backend.connectors) {
      const display = findDisplay(entry.connectorId);
      const id = display?.id ?? entry.connectorId;
      seen.add(id);
      out.push({
        id,
        label: display?.label ?? entry.label,
        vendor: display?.vendor ?? "—",
        domain: display?.domain ?? "donor",
        monogram: display?.monogram ?? entry.label.charAt(0).toUpperCase(),
        blurb: display?.blurb ?? "",
        status: display?.forcedStatus ?? backendStatusToVisual(entry.status),
        recordCount: entry.recordCount ?? null,
        lastSyncedAt: entry.lastSuccessAt ?? entry.lastSyncAt,
        lastError: entry.lastError,
      });
    }
  }

  // Second pass: any display-only tiles not in backend (the "future" ones).
  for (const display of CONNECTOR_DISPLAYS) {
    if (seen.has(display.id)) continue;
    out.push({
      ...display,
      status: display.forcedStatus ?? "available",
      recordCount: null,
      lastSyncedAt: null,
    });
  }

  return out;
}

function backendStatusToVisual(s: BackendSyncEntry["status"]): ConnectorVisualStatus {
  if (s === "connected") return "connected";
  if (s === "error") return "needs_setup";
  return "available"; // never / syncing
}

function ConnectorTile({
  tile,
  isPulsing,
  callCount,
  onOpen,
}: {
  tile: MergedTile;
  isPulsing: boolean;
  callCount: number;
  onOpen: (id: string) => void;
}) {
  const isConnected = tile.status === "connected";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(tile.id)}
        className={`group flex w-full items-center gap-2.5 rounded border px-2.5 py-2 text-left transition-all ${isPulsing ? "source-pulse" : ""} border-[var(--mint-line)] bg-[var(--surface)] hover:border-[var(--matcha-mid)] hover:bg-[var(--mint-pale)]`}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded font-display text-[15px] font-medium"
          style={{
            background: isConnected ? "var(--matcha-mid)" : "var(--mint-pale)",
            color: isConnected ? "var(--cream)" : "var(--gray-ink)",
          }}
          aria-hidden
        >
          {tile.monogram}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-[var(--matcha-deep)]">{tile.label}</span>
            <StatusPip status={tile.status} />
          </span>
          <span className="block truncate font-mono text-[10px] text-[var(--gray-ink)]">
            {captionFor(tile, callCount)}
          </span>
        </span>
      </button>
    </li>
  );
}

function StatusPip({ status }: { status: ConnectorVisualStatus }) {
  const color =
    status === "connected" ? "var(--matcha-mid)"
    : status === "needs_setup" ? "var(--strawberry-deep)"
    : "var(--gray-ink)";
  return (
    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} title={status} />
  );
}

function captionFor(t: MergedTile, callCount: number): string {
  if (t.status === "connected") {
    const parts: string[] = [];
    if (t.recordCount != null) parts.push(`${t.recordCount.toLocaleString()} recs`);
    parts.push(formatRelative(t.lastSyncedAt));
    if (callCount > 0) parts.push(`${callCount} call${callCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }
  if (t.status === "available") return "available · click to add";
  if (t.status === "needs_setup") return t.lastError ? `error: ${t.lastError.slice(0, 28)}` : "setup needed";
  return "";
}
