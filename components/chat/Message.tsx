"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildCitationMap } from "../../lib/agent/citations";
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
          <div
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 12,
              background: "var(--mochi)",
              border: "2px solid white",
              color: "var(--matcha-deep-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
              boxShadow: "1px 2px 0 var(--sticker-shadow)",
              transform: "rotate(-2deg)",
            }}
            aria-label="you"
          >
            you
          </div>
          <div className="flex-1 pt-0.5">
            <div
              className="kawaii-bubble kawaii-bubble--mochi"
              style={{ display: "inline-block", maxWidth: "100%" }}
            >
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--ink)" }}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { text, streaming, toolCalls, stats, error, citations } = message;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-start gap-3 py-5">
        <div
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 12,
            background: "var(--matcha-pale)",
            border: "2px solid white",
            color: "var(--matcha-deep-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
            boxShadow: "1px 2px 0 var(--sticker-shadow-deep)",
            transform: "rotate(2deg)",
          }}
          aria-label="kali"
        >
          k
        </div>
        <div className="flex-1 space-y-2 pt-0.5">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
            kali
            {streaming && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />}
          </span>

          {toolCalls.length > 0 && <ToolCallTrace toolCalls={toolCalls} />}

          {text && (
            <div className="markdown-body space-y-2">
              <AnswerMarkdown text={text} citations={citations} onActivate={onActivateCitation} />
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
 * Render the assistant's answer as proper markdown (headers, bullets,
 * numbered lists, code blocks, tables) AND replace `[N]` citation markers
 * inline with <CitationChip>. We use react-markdown for the block-level
 * structure and walk text-node children to splice in chips.
 */
function AnswerMarkdown({
  text,
  citations,
  onActivate,
}: {
  text: string;
  citations: string[];
  onActivate?: (kaliId: string) => void;
}) {
  const map = buildCitationMap(citations);

  const wrap = (children: ReactNode) => withChips(children, map, onActivate);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="r-display mt-3 text-[26px] font-medium leading-tight tracking-tight text-[var(--matcha-deep)] sm:text-[28px]">
            {wrap(children)}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="r-display mt-3 text-[22px] font-medium leading-tight tracking-tight text-[var(--matcha-deep)]">
            {wrap(children)}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 text-[16px] font-semibold leading-snug text-[var(--matcha-deep)]">
            {wrap(children)}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-[var(--matcha-deep)]">
            {wrap(children)}
          </h4>
        ),
        p: ({ children }) => (
          <p className="text-[15px] leading-relaxed text-[var(--matcha-deep)]">{wrap(children)}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-2 ml-4 list-disc space-y-1 text-[15px] leading-relaxed text-[var(--matcha-deep)] marker:text-[var(--matcha-mid)]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 ml-5 list-decimal space-y-1 text-[15px] leading-relaxed text-[var(--matcha-deep)] marker:text-[var(--matcha-mid)]">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{wrap(children)}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--matcha-deep)]">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-[var(--matcha-mid)] underline underline-offset-2 hover:text-[var(--matcha-deep)]">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-[var(--matcha-mid)] bg-[var(--mint-pale)]/30 px-3 py-1.5 text-[14px] italic text-[var(--matcha-deep)]">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = (className ?? "").startsWith("language-");
          if (isBlock) {
            return (
              <code className="block">{children}</code>
            );
          }
          return (
            <code className="rounded bg-[var(--mint-pale)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--matcha-deep)]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] p-3 font-mono text-[12px] leading-snug text-[var(--matcha-deep)]">
            {children}
          </pre>
        ),
        hr: () => <hr className="my-3 border-t border-[var(--mint-line)]" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-[13px] text-[var(--matcha-deep)]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-[var(--mint-line)] bg-[var(--mint-pale)]/40 text-left">{children}</thead>
        ),
        th: ({ children }) => <th className="px-2 py-1.5 font-medium">{wrap(children)}</th>,
        td: ({ children }) => <td className="border-b border-[var(--mint-line-soft)] px-2 py-1.5">{wrap(children)}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/**
 * Walk a ReactNode children prop and, for any string segment, splice
 * `[N]` markers into <CitationChip number={N} kaliId={...} /> components.
 * Non-string children pass through untouched.
 */
function withChips(
  children: ReactNode,
  map: Record<number, string>,
  onActivate?: (id: string) => void,
): ReactNode {
  const out: ReactNode[] = [];
  let key = 0;
  Children.forEach(children, (child) => {
    if (typeof child === "string") {
      out.push(...spliceChips(child, map, onActivate, () => key++));
    } else {
      out.push(child);
    }
  });
  return out;
}

const CITATION_RE = /\[(\d+)\]/g;

function spliceChips(
  s: string,
  map: Record<number, string>,
  onActivate?: (id: string) => void,
  nextKey?: () => number,
): ReactNode[] {
  const out: ReactNode[] = [];
  CITATION_RE.lastIndex = 0;
  let cursor = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const k = () => (nextKey ? nextKey() : i++);
  while ((m = CITATION_RE.exec(s)) !== null) {
    if (m.index > cursor) out.push(<span key={k()}>{s.slice(cursor, m.index)}</span>);
    const n = parseInt(m[1], 10);
    const id = map[n];
    if (id) {
      out.push(<CitationChip key={k()} number={n} kaliId={id} onActivate={onActivate} />);
    } else {
      // unresolved — keep literal so prose isn't dropped
      out.push(<span key={k()}>{m[0]}</span>);
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < s.length) out.push(<span key={k()}>{s.slice(cursor)}</span>);
  return out;
}
