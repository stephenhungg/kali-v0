"use client";

import { useEffect, useState } from "react";
import { CuteCard, CutePill } from "../kawaii/CutePrimitives";
import { Mascot } from "../kawaii/Mascot";

interface RecentActivityProps {
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

const TONE_BY_SOURCE: Record<string, "matcha" | "sakura" | "lemon" | "cloud" | "mochi" | "neutral"> = {
  bloomerang: "mochi",
  salesforce: "matcha",
  m365: "cloud",
  zoom: "cloud",
  sharepoint: "lemon",
  instrumentl: "matcha",
  quickbooks: "matcha",
  solana: "lemon",
  powerbi: "matcha",
  powerautomate: "lemon",
  knowbe4: "sakura",
  x402: "sakura",
  causecoin: "lemon",
  context: "neutral",
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
        <h2 className="kawaii-mono-tag">recent agent activity</h2>
        <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
          {entries?.length ?? 0} tool calls
        </span>
      </div>
      <CuteCard tone="paper" style={{ padding: 0 }}>
        {entries === null && !error && (
          <div style={{ padding: "32px 22px", textAlign: "center", color: "var(--mute)", fontSize: 13 }}>
            loading…
          </div>
        )}
        {error && (
          <div style={{ padding: "20px 22px", color: "var(--strawberry-deep)", fontSize: 13 }}>
            could not load audit log: {error}
          </div>
        )}
        {entries && entries.length === 0 && (
          <div style={{ padding: "30px 22px 28px", textAlign: "center" }}>
            <Mascot pose="sleep" size={72} />
            <div style={{ marginTop: 8, color: "var(--mute)", fontSize: 13, lineHeight: 1.5 }}>
              no agent activity yet — open the chat and ask a question
              <br />to populate the audit log.
            </div>
          </div>
        )}
        {entries && entries.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {entries.map((e, i) => (
              <li
                key={e.id}
                className="row-rise"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : "1px dashed var(--hair)",
                }}
              >
                <CutePill tone={TONE_BY_SOURCE[e.source] ?? "neutral"}>{e.source}</CutePill>
                <code
                  style={{
                    fontFamily: "var(--font-mono-geist), ui-monospace, monospace",
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                >
                  {e.toolName}
                  <span style={{ color: "var(--mute)", marginLeft: 8 }}>
                    {e.recordIds.length > 0
                      ? `→ ${e.recordIds.length} record${e.recordIds.length === 1 ? "" : "s"}`
                      : "→ no records"}
                  </span>
                </code>
                <span style={{ fontSize: 11, color: "var(--mute)" }}>
                  {formatRelative(e.recordedAt)} · {e.durationMs}ms
                </span>
              </li>
            ))}
          </ul>
        )}
      </CuteCard>
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
