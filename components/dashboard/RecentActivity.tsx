"use client";

import { useEffect, useState } from "react";

interface RecentActivityProps {
  /** Tenant id to query the audit log for. */
  tenantId?: string;
}

interface AuditRecord {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  recordedAt: string;
  source: string;
  toolName: string;
  paramsHash: string;
  recordIds: string[];
  durationMs: number;
}

const ACCENT_BY_SOURCE: Record<string, string> = {
  bloomerang: "var(--matcha-mid)",
  salesforce: "var(--matcha-mid)",
  m365: "var(--matcha-mid)",
  zoom: "var(--matcha-mid)",
  sharepoint: "var(--matcha-mid)",
  instrumentl: "var(--matcha-deep)",
  quickbooks: "var(--matcha-deep)",
  solana: "var(--matcha-deep)",
  powerbi: "var(--matcha-deep)",
  powerautomate: "var(--matcha-deep)",
  knowbe4: "var(--strawberry-deep)",
  x402: "var(--strawberry-deep)",
  causecoin: "var(--strawberry-deep)",
  context: "var(--gray-ink)",
};

export function RecentActivity({ tenantId = "rivertown" }: RecentActivityProps) {
  const [entries, setEntries] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/audit?tenantId=${encodeURIComponent(tenantId)}&limit=12`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((data: { entries: AuditRecord[] }) => {
        if (alive) setEntries(data.entries);
      })
      .catch((e: unknown) => {
        if (alive) setError(typeof e === "string" ? e : "fetch failed");
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          recent agent activity
        </h2>
        <span className="font-mono text-[10px] text-[var(--gray-ink)]">
          {entries?.length ?? 0} tool calls
        </span>
      </div>
      <ul className="chat-card divide-y divide-[var(--mint-line-soft)] rounded">
        {entries === null && !error && (
          <li className="px-3 py-3 text-[12px] text-[var(--gray-ink)]">loading…</li>
        )}
        {error && (
          <li className="px-3 py-3 text-[12px] text-[var(--strawberry-deep)]">
            could not load audit log: {error}
          </li>
        )}
        {entries && entries.length === 0 && (
          <li className="px-3 py-4 text-[12px] text-[var(--gray-ink)]">
            no agent activity yet — open the chat and ask a question to populate the audit log.
          </li>
        )}
        {entries?.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium"
              style={{
                background: "var(--mint-pale)",
                color: ACCENT_BY_SOURCE[e.source] ?? "var(--gray-ink)",
              }}
              title={e.source}
            >
              ·
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--matcha-deep)]">
              <code className="font-mono text-[11px] text-[var(--matcha-mid)]">
                {e.toolName}
              </code>
              <span className="ml-2 text-[var(--gray-ink)]">
                {e.recordIds.length > 0
                  ? `→ ${e.recordIds.length} record${e.recordIds.length === 1 ? "" : "s"}`
                  : "→ no records"}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[10px] text-[var(--gray-ink)]">
              {formatRelative(e.recordedAt)} · {e.durationMs}ms
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
