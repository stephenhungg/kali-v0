"use client";

import { useEffect, useState } from "react";

export interface ConversationSummary {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationHistoryProps {
  /** Currently-loaded conversation id (highlighted in the list). */
  activeId: string | null;
  /** Bumped by the chat page after each successful turn — triggers a refresh. */
  refreshKey: number;
  onLoad: (id: string) => void;
  onDelete?: (id: string) => void;
  onNewChat: () => void;
}

export function ConversationHistory({
  activeId,
  refreshKey,
  onLoad,
  onDelete,
  onNewChat,
}: ConversationHistoryProps) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch("/api/conversations?limit=100")
      .then(r => r.ok ? r.json() : Promise.reject(`status ${r.status}`))
      .then((data: { conversations: ConversationSummary[] }) => {
        if (alive) setItems(data.conversations ?? []);
      })
      .catch(e => {
        if (alive) {
          setItems([]);
          setError(typeof e === "string" ? e : "load failed");
        }
      });
    return () => { alive = false; };
  }, [refreshKey]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete ${res.status}`);
      setItems(prev => prev?.filter(c => c.id !== id) ?? null);
      onDelete?.(id);
    } catch {
      // silent — stays in list
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2.5">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-between gap-2 rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-[var(--matcha-mid)] hover:bg-[var(--mint-pale)]"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--matcha-deep)]">
            + new chat
          </span>
          <span className="font-mono text-[10px] text-[var(--gray-ink)]">⌘K</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {items === null ? (
          <div className="px-3 py-2 font-mono text-[11px] text-[var(--gray-ink)]">loading…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-3 text-[12px] leading-snug text-[var(--gray-ink)]">
            {error ? <span className="text-[var(--strawberry-deep)]">{error}</span> : "No saved conversations yet. Ask Kali a question and it'll show up here."}
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map(c => (
              <ConversationRow
                key={c.id}
                conv={c}
                isActive={c.id === activeId}
                onLoad={onLoad}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  isActive,
  onLoad,
  onDelete,
}: {
  conv: ConversationSummary;
  isActive: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const title = (conv.title ?? "Untitled").trim();
  const sub = formatRelative(conv.updatedAt);

  return (
    <li>
      <button
        type="button"
        onClick={() => onLoad(conv.id)}
        className={`group relative flex w-full flex-col items-start gap-0.5 rounded px-2.5 py-2 text-left transition-colors ${
          isActive
            ? "bg-[var(--mint-pale)] text-[var(--matcha-deep)]"
            : "text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]/60"
        }`}
      >
        <span className="line-clamp-1 w-full pr-7 text-[13px] font-medium leading-snug">
          {title}
        </span>
        <span className="font-mono text-[10px] text-[var(--gray-ink)]">
          {sub} · {conv.messageCount} msg{conv.messageCount === 1 ? "" : "s"}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onDelete(conv.id, e)}
          onKeyDown={(e) => { if (e.key === "Enter") onDelete(conv.id, e as unknown as React.MouseEvent); }}
          aria-label="Delete conversation"
          className="absolute right-2 top-2 hidden h-5 w-5 cursor-pointer items-center justify-center rounded font-mono text-[12px] text-[var(--gray-ink)] hover:bg-[var(--surface)] hover:text-[var(--strawberry-deep)] group-hover:flex"
        >
          ×
        </span>
      </button>
    </li>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)}h ago`;
  if (ms < 7 * 86400_000) return `${Math.round(ms / 86400_000)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
