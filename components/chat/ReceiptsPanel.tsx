"use client";

import { useMemo } from "react";
import type { ChatMessage, ToolCallRow } from "../../hooks/useAgentStream";

interface ReceiptsPanelProps {
  messages: ChatMessage[];
  onActivateCitation?: (kaliId: string) => void;
}

/**
 * Right-rail receipts panel.
 *
 * Two sections backed by the live event stream:
 *   1. Live tool-call ticker (latest assistant turn)
 *   2. Citation index (every kali_entity_id surfaced + the [N]s referenced inline)
 */
export function ReceiptsPanel({ messages, onActivateCitation }: ReceiptsPanelProps) {
  const latestAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i] as ChatMessage & { role: "assistant" };
    }
    return null;
  }, [messages]);

  const allCitations = useMemo(() => {
    const seen = new Map<string, { id: string; cited: boolean; n?: number }>();
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const id of m.citations) {
        if (!seen.has(id)) seen.set(id, { id, cited: false });
      }
      for (const c of m.citationsCited) {
        seen.set(c.kali_entity_id, { id: c.kali_entity_id, cited: true, n: c.n });
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      if (a.cited !== b.cited) return a.cited ? -1 : 1;
      if (a.n != null && b.n != null) return a.n - b.n;
      return a.id.localeCompare(b.id);
    });
  }, [messages]);

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--mint-line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="r-display text-[18px] font-medium tracking-tight text-[var(--matcha-deep)]">Receipts</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">proof of work</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--gray-ink)]">
          Every claim Kali makes is provable here — tool calls + cited records. No black boxes.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section title="latest tool calls" count={latestAssistant?.toolCalls.length ?? 0}>
          {latestAssistant && latestAssistant.toolCalls.length > 0 ? (
            <ToolCallTicker calls={latestAssistant.toolCalls} />
          ) : (
            <Empty>No tools fired yet. Ask a question to see the agent reach across your stack.</Empty>
          )}
        </Section>

        <Section title="cited records" count={allCitations.length}>
          {allCitations.length > 0 ? (
            <div className="divide-y divide-[var(--mint-line-soft)]">
              {allCitations.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onActivateCitation?.(c.id)}
                  className="row-rise flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--mint-pale)]/50"
                >
                  {c.cited ? (
                    <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded border border-[var(--matcha-mid)] bg-[var(--surface)] px-1 font-mono text-[10px] font-medium text-[var(--matcha-mid)]">
                      {c.n}
                    </span>
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gray-ink)]" />
                  )}
                  <span className="flex-1 truncate font-mono text-[11px] text-[var(--matcha-deep)]">
                    {c.id}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--gray-ink)]">
                    {c.cited ? "in answer" : "consulted"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty>kali_entity_ids surfaced by tool calls (and the chips referenced inline) show up here.</Empty>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, count, children }: { title: string; count: number | null; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--mint-line-soft)]">
      <header className="flex items-center justify-between px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">{title}</h3>
        {count !== null && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--matcha-mid)]">{count}</span>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pb-4 text-[12px] leading-snug text-[var(--gray-ink)]">{children}</div>;
}

function ToolCallTicker({ calls }: { calls: ToolCallRow[] }) {
  return (
    <div className="divide-y divide-[var(--mint-line-soft)]">
      {calls.map(c => (
        <div key={c.id} className="row-rise flex items-center gap-2.5 px-3 py-2">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              c.status === "running" ? "bg-[var(--matcha-mid)] blink-soft"
              : c.status === "error" ? "bg-[var(--strawberry-deep)]"
              : "bg-[var(--matcha-mid)]"
            }`}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--matcha-deep)]">{c.name}</span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--gray-ink)]">
            {c.durationMs != null ? `${c.durationMs}ms` : "…"}
          </span>
        </div>
      ))}
    </div>
  );
}
