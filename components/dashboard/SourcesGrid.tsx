"use client";

import { useEffect, useState } from "react";
import { findDisplay, formatRelative, type ConnectorDisplay } from "../../lib/connectors/status";
import { ConnectorDrawer } from "../chat/ConnectorDrawer";

interface BackendSyncEntry {
  connectorId: string;
  label: string;
  status: "never" | "syncing" | "connected" | "error";
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  recordCount?: number;
  lastError?: string;
}

interface SourcesGridProps {
  selectedConnectors: string[];
}

export function SourcesGrid({ selectedConnectors }: SourcesGridProps) {
  const [backend, setBackend] = useState<BackendSyncEntry[] | null>(null);
  const [activeConnector, setActiveConnector] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/connectors/status")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (alive) setBackend(data.connectors ?? []); })
      .catch(() => { if (alive) setBackend([]); });
    return () => { alive = false; };
  }, []);

  // Filter backend connectors down to user's selected list. Fallback: if no
  // selections (demo mode), show everything.
  const tiles = backend?.filter(b =>
    selectedConnectors.length === 0 || selectedConnectors.includes(b.connectorId),
  ).map(b => ({ entry: b, display: findDisplay(b.connectorId) })).filter(t => t.display) ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          your sources · {tiles.length} connected
        </h2>
        <button
          type="button"
          onClick={() => setActiveConnector("mailchimp")}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--matcha-mid)] hover:text-[var(--matcha-deep)]"
        >
          + add source
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {backend === null ? (
          <div className="font-mono text-[11px] text-[var(--gray-ink)]">loading…</div>
        ) : tiles.length === 0 ? (
          <div className="col-span-full rounded border border-dashed border-[var(--mint-line)] bg-[var(--surface-raised)] p-4 text-[12px] text-[var(--gray-ink)]">
            no sources connected. <button type="button" onClick={() => setActiveConnector("bloomerang")} className="text-[var(--matcha-mid)] underline-offset-2 hover:underline">add one</button> to get started.
          </div>
        ) : (
          tiles.map(({ entry, display }) => (
            <SourceTile
              key={entry.connectorId}
              entry={entry}
              display={display!}
              onOpen={() => setActiveConnector(entry.connectorId)}
            />
          ))
        )}
      </div>

      <ConnectorDrawer connectorId={activeConnector} onClose={() => setActiveConnector(null)} />
    </section>
  );
}

function SourceTile({
  entry,
  display,
  onOpen,
}: {
  entry: BackendSyncEntry;
  display: ConnectorDisplay;
  onOpen: () => void;
}) {
  const isOk = entry.status === "connected";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="chat-card group flex items-start gap-3 rounded px-3 py-3 text-left transition-all hover:border-[var(--matcha-mid)] hover:bg-[var(--mint-pale)]"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded font-display text-[18px] font-medium"
        style={{
          background: isOk ? "var(--matcha-mid)" : "var(--mint-pale)",
          color: isOk ? "var(--cream)" : "var(--gray-ink)",
        }}
      >
        {display.monogram}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-[var(--matcha-deep)]">
            {display.label}
          </span>
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: isOk ? "var(--matcha-mid)" : "var(--strawberry-deep)" }}
          />
        </span>
        <span className="block font-mono text-[10px] text-[var(--gray-ink)]">
          {isOk
            ? `${entry.recordCount?.toLocaleString() ?? "—"} recs · ${formatRelative(entry.lastSuccessAt ?? entry.lastSyncAt)}`
            : entry.lastError?.slice(0, 40) ?? "needs setup"}
        </span>
      </span>
    </button>
  );
}
