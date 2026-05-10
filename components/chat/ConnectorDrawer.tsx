"use client";

import { useEffect, useState } from "react";
import { findDisplay, formatRelative, type ConnectorDisplay, type ConnectorVisualStatus } from "../../lib/connectors/status";
import { MockOAuthModal } from "./MockOAuthModal";

interface ConnectorDrawerProps {
  connectorId: string | null;
  onClose: () => void;
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

interface DrawerData {
  display: ConnectorDisplay;
  status: ConnectorVisualStatus;
  recordCount: number | null;
  lastSyncedAt: string | null;
  lastError?: string;
}

export function ConnectorDrawer({ connectorId, onClose }: ConnectorDrawerProps) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [showOAuth, setShowOAuth] = useState(false);

  useEffect(() => {
    if (!connectorId) { setData(null); return; }
    let alive = true;
    (async () => {
      const display = findDisplay(connectorId);
      if (!display) { setData(null); return; }
      try {
        const res = await fetch("/api/connectors/status");
        const json = await res.json();
        const entry = (json.connectors as BackendSyncEntry[]).find(c => c.connectorId === display.id);
        if (!alive) return;
        if (!entry) {
          setData({
            display,
            status: display.forcedStatus ?? "available",
            recordCount: null,
            lastSyncedAt: null,
          });
          return;
        }
        setData({
          display,
          status: display.forcedStatus ?? backendStatusToVisual(entry.status),
          recordCount: entry.recordCount ?? null,
          lastSyncedAt: entry.lastSuccessAt ?? entry.lastSyncAt,
          lastError: entry.lastError,
        });
      } catch {
        if (alive) setData({ display, status: display.forcedStatus ?? "available", recordCount: null, lastSyncedAt: null });
      }
    })();
    return () => { alive = false; };
  }, [connectorId]);

  useEffect(() => {
    if (!connectorId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectorId, onClose]);

  if (!connectorId) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-[var(--matcha-deep)]/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col overflow-hidden border-l border-[var(--mint-line)] bg-[var(--surface)] shadow-2xl sm:w-[480px]"
        style={{ animation: `r-rise 320ms var(--r-ease)` }}
      >
        {data && (
          <>
            <header className="flex items-center justify-between border-b border-[var(--mint-line)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded font-display text-[18px] font-medium"
                  style={{
                    background: data.status === "connected" ? "var(--matcha-mid)" : "var(--mint-pale)",
                    color: data.status === "connected" ? "var(--cream)" : "var(--gray-ink)",
                  }}
                >
                  {data.display.monogram}
                </span>
                <div>
                  <h2 className="r-display text-[22px] font-medium tracking-tight text-[var(--matcha-deep)]">{data.display.label}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
                    {data.display.vendor} · {data.display.domain}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]">close ✕</button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]">{data.display.blurb}</p>

              {data.status === "connected" && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Stat label="records" value={data.recordCount?.toLocaleString() ?? "—"} />
                  <Stat label="last sync" value={formatRelative(data.lastSyncedAt)} />
                  <Stat label="status" value="connected" accent="var(--matcha-mid)" />
                  <Stat label="mode" value="read-only" />
                </div>
              )}

              {data.status === "available" && (
                <div className="mt-5 rounded border border-dashed border-[var(--mint-line)] bg-[var(--mint-pale)]/30 p-4 text-[13px] text-[var(--matcha-deep)]">
                  <p>This source is supported but not yet connected. Click below to start the OAuth flow and Kali will index your data within a few minutes.</p>
                </div>
              )}

              {data.status === "needs_setup" && (
                <div className="mt-5 rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 p-4 text-[13px] text-[var(--matcha-deep)]">
                  <p className="font-medium text-[var(--strawberry-deep)]">Setup required</p>
                  <p className="mt-1">{data.lastError ? `Error: ${data.lastError}` : "An admin needs to provide an API key from this system before Kali can index it."}</p>
                </div>
              )}

              <div className="mt-6 rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] p-3 text-[12px] leading-relaxed text-[var(--gray-ink)]">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">how kali uses {data.display.label}</span>
                <p className="mt-1 text-[var(--matcha-deep)]">
                  When you ask a question that touches {data.display.domain} data, Kali calls tools from this connector and cites the records inline in the answer.
                </p>
              </div>
            </div>

            <footer className="border-t border-[var(--mint-line)] bg-[var(--surface-raised)] p-4">
              <button
                type="button"
                onClick={() => setShowOAuth(true)}
                className="w-full rounded bg-[var(--strawberry-deep)] px-4 py-2.5 text-[13px] font-medium text-[var(--cream)] transition-transform hover:scale-[1.01]"
              >
                {data.status === "connected" ? "reconfigure connection" : "configure connection"}
              </button>
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">demo · oauth flow preview</p>
            </footer>
          </>
        )}

        {showOAuth && data && (
          <MockOAuthModal connector={data.display} onClose={() => setShowOAuth(false)} />
        )}
      </aside>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">{label}</div>
      <div className="mt-0.5 text-[16px] font-medium" style={{ color: accent ?? "var(--matcha-deep)" }}>{value}</div>
    </div>
  );
}

function backendStatusToVisual(s: BackendSyncEntry["status"]): ConnectorVisualStatus {
  if (s === "connected") return "connected";
  if (s === "error") return "needs_setup";
  return "available";
}
