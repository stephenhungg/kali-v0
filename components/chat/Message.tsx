"use client";

import { Fragment, type ReactNode } from "react";
import { tokenizeAnswer } from "../../lib/agent/render";
import type { ChatMessage } from "../../hooks/useAgentStream";
import { CitationChip } from "./CitationChip";
import { ToolCallTrace } from "./ToolCallTrace";

interface MessageProps {
  message: ChatMessage;
  onActivateCitation?: (kaliId: string) => void;
}

export function Message({ message, onActivateCitation }: MessageProps) {
  if (message.role === "user") {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-start gap-3 py-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--matcha-mid)]/15 text-xs font-medium text-[var(--matcha-deep)]">
            R
          </div>
          <div className="flex-1 pt-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">you</span>
            <p className="mt-0.5 text-[15px] leading-relaxed text-[var(--matcha-deep)]">{message.text}</p>
          </div>
        </div>
      </div>
    );
  }

  const { text, streaming, toolCalls, stats, error, citations } = message;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-start gap-3 py-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--matcha-deep)] text-[11px] font-medium text-[var(--cream)]">
          K
        </div>
        <div className="flex-1 space-y-2 pt-0.5">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
            kali
            {streaming && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />}
          </span>

          {toolCalls.length > 0 && <ToolCallTrace toolCalls={toolCalls} />}

          {text && (
            <div className="space-y-1.5">
              <AnswerBody text={text} citations={citations} onActivate={onActivateCitation} />
              {streaming && <span className="inline-block h-4 w-[2px] bg-[var(--matcha-mid)] blink-soft align-middle" />}
            </div>
          )}

          {!text && streaming && toolCalls.length === 0 && (
            <p className="text-[14px] italic text-[var(--gray-ink)]">thinking…</p>
          )}

          {error && (
            <div className="rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 px-3 py-2 text-[13px] text-[var(--strawberry-deep)]">
              {error}
            </div>
          )}

          {stats.done && !error && (
            <div className="pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--gray-ink)]">
              iter {stats.iterations} · {stats.toolCalls} tools · {stats.inputTokens.toLocaleString()}t in / {stats.outputTokens.toLocaleString()}t out
              {stats.cachedInputTokens > 0 ? ` · ${stats.cachedInputTokens.toLocaleString()}t cached` : ""}
              {" · "}{(stats.durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Render the assistant's answer with [N] citation markers replaced by chips,
 * preserving line breaks and lightweight bullet lists. We use lib/agent/render's
 * `tokenizeAnswer` so the citation indexing matches what the backend emitted.
 */
function AnswerBody({
  text,
  citations,
  onActivate,
}: {
  text: string;
  citations: string[];
  onActivate?: (kaliId: string) => void;
}) {
  const tokens = tokenizeAnswer(text, citations);
  // Re-segment tokens by line breaks so we can render <p> per line + <li> for bullets.
  const lines: Array<Array<typeof tokens[number]>> = [[]];
  for (const tok of tokens) {
    if (tok.kind === "text") {
      const parts = tok.value.split("\n");
      parts.forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push({ kind: "text", value: part });
      });
    } else {
      lines[lines.length - 1].push(tok);
    }
  }

  return (
    <>
      {lines.map((lineTokens, lineIdx) => {
        const flat = lineTokens.map(t => t.kind === "text" ? t.value : "").join("");
        if (flat.trim() === "" && lineTokens.every(t => t.kind === "text")) {
          return <div key={lineIdx} className="h-2" aria-hidden />;
        }
        const isBullet = /^\s*[-•]\s/.test(flat);
        if (isBullet) {
          // strip the leading marker from the first text token
          const stripped = stripBulletPrefix(lineTokens);
          return (
            <li key={lineIdx} className="ml-4 list-disc text-[15px] leading-relaxed text-[var(--matcha-deep)] marker:text-[var(--matcha-mid)]">
              {renderTokens(stripped, onActivate)}
            </li>
          );
        }
        return (
          <p key={lineIdx} className="text-[15px] leading-relaxed text-[var(--matcha-deep)]">
            {renderTokens(lineTokens, onActivate)}
          </p>
        );
      })}
    </>
  );
}

function stripBulletPrefix(tokens: Array<{ kind: "text"; value: string } | { kind: "chip"; n: number; kali_entity_id: string; raw: string }>) {
  if (tokens.length === 0) return tokens;
  const first = tokens[0];
  if (first.kind === "text") {
    return [{ kind: "text" as const, value: first.value.replace(/^\s*[-•]\s/, "") }, ...tokens.slice(1)];
  }
  return tokens;
}

function renderTokens(
  tokens: Array<{ kind: "text"; value: string } | { kind: "chip"; n: number; kali_entity_id: string; raw: string }>,
  onActivate?: (id: string) => void,
): ReactNode[] {
  return tokens.map((t, i) => {
    if (t.kind === "chip") {
      return <CitationChip key={i} number={t.n} kaliId={t.kali_entity_id} onActivate={onActivate} />;
    }
    return <Fragment key={i}>{renderInline(t.value, `${i}_inl`)}</Fragment>;
  });
}

/** Inline emphasis: **bold** and `code`. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}_${i++}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={`${keyBase}_${i++}`} className="font-semibold text-[var(--matcha-deep)]">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={`${keyBase}_${i++}`} className="rounded bg-[var(--mint-pale)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--matcha-deep)]">{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}_${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}
