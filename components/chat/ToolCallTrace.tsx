"use client";

import { useState } from "react";
import type { ToolCallRow } from "../../hooks/useAgentStream";

interface ToolCallTraceProps {
  toolCalls: ToolCallRow[];
}

/**
 * Per-message receipts ledger. Default-collapsed; one click expands the
 * whole block, another click on any row drills into full input/output JSON.
 */
export function ToolCallTrace({ toolCalls }: ToolCallTraceProps) {
  const [expanded, setExpanded] = useState(true);

  const running = toolCalls.filter(t => t.status === "running").length;
  const errors = toolCalls.filter(t => t.status === "error").length;
  const totalMs = toolCalls.reduce((s, t) => s + (t.durationMs ?? 0), 0);

  return (
    <div className="rounded border border-[var(--mint-line)] bg-[var(--surface-raised)]">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--mint-pale)]/50"
      >
        <span className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">tool calls</span>
          <span className="font-mono text-[11px] text-[var(--matcha-deep)]">
            {toolCalls.length}{running > 0 ? ` · ${running} running` : ""}{errors > 0 ? ` · ${errors} err` : ""}
          </span>
          {totalMs > 0 && (
            <span className="font-mono text-[10px] text-[var(--gray-ink)]">{totalMs}ms</span>
          )}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
          {expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--mint-line-soft)] divide-y divide-[var(--mint-line-soft)]">
          {toolCalls.map(t => (
            <ToolCallRowView key={t.id} row={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallRowView({ row }: { row: ToolCallRow }) {
  const [open, setOpen] = useState(false);

  const summary = summarize(row);
  const isRunning = row.status === "running";
  const isError = row.status === "error";

  return (
    <div className="row-rise">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--mint-pale)]/40"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              isError ? "bg-[var(--strawberry-deep)]"
              : isRunning ? "bg-[var(--matcha-mid)] blink-soft"
              : "bg-[var(--matcha-mid)]"
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[12px] text-[var(--matcha-deep)]">{row.name}</span>
            <span className="block truncate font-mono text-[10px] text-[var(--gray-ink)]">{summary}</span>
          </span>
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--gray-ink)]">
          {row.durationMs != null ? `${row.durationMs}ms` : "…"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--mint-line-soft)] bg-[var(--mint-pale)]/30 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">input</div>
          <pre className="overflow-x-auto rounded bg-[var(--surface)] p-2 font-mono text-[11px] leading-snug text-[var(--matcha-deep)]">
{formatJson(row.input)}
          </pre>
          {row.result !== undefined && (
            <>
              <div className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
                {row.isError ? "error" : "output"}
              </div>
              <pre className="max-h-[280px] overflow-auto rounded bg-[var(--surface)] p-2 font-mono text-[11px] leading-snug text-[var(--matcha-deep)]">
{formatJson(row.result)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function summarize(row: ToolCallRow): string {
  if (row.status === "running") {
    const inp = row.input;
    if (inp && typeof inp === "object" && !Array.isArray(inp)) {
      const entries = Object.entries(inp).slice(0, 3);
      return entries.map(([k, v]) => `${k}=${truncate(JSON.stringify(v), 40)}`).join(" ");
    }
    return "running…";
  }
  if (row.status === "error") {
    const r: any = row.result;
    return `error: ${truncate(typeof r === "string" ? r : (r?.error ?? JSON.stringify(r)), 80)}`;
  }
  const r: any = row.result;
  if (!r) return "(empty)";
  if (typeof r === "string") return truncate(r, 80);
  if (typeof r.count === "number") return `${r.count} record${r.count === 1 ? "" : "s"}`;
  if (Array.isArray(r)) return `${r.length} items`;
  if (r.totalCashOnHand != null) return `$${Number(r.totalCashOnHand).toLocaleString()} cash on hand`;
  if (r.programs) return `${r.programs.length} programs`;
  if (r.success) return `success`;
  return truncate(JSON.stringify(r), 80);
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
