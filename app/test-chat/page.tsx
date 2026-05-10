/**
 * /test-chat — minimal visual diagnostic for the SSE chat endpoint.
 *
 * Plain monospace UI that posts a query, parses the SSE stream, and renders
 * each event live. The "real" chat UI (frank/nicole/stephen lane) will
 * replace this with the source-pulse panel + citation chips, but this page
 * exists so backend can verify the wire protocol end-to-end without
 * waiting on UI work.
 */

"use client";

import { useEffect, useRef, useState } from "react";

interface AgentEvent {
  type: "start" | "tool_call" | "tool_result" | "text" | "done" | "error";
  [key: string]: unknown;
}

const SAMPLE_QUERIES = [
  "Find lapsed donors who gave $1K+ at any point and work at companies with matching gift programs. Top 5.",
  "What grants are closing in the next 60 days, and which board members have ties to those funders?",
  "Show our cash runway over the next 6 months and flag anything from recent SharePoint reports about programs at risk.",
  "Analyse the last 90 days of email patterns and Power Automate runs. Suggest one new workflow that would save 5+ hrs/week.",
  "Tell me everything we know about Antoinette Steuber.",
];

export default function TestChatPage() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0]);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    if (running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setEvents([]);
    setRunning(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, conversationId }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        setEvents([{ type: "error", message: `HTTP ${res.status}` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by `\n\n`. Parse complete frames.
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = frame
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const ev = JSON.parse(dataLine.slice("data: ".length)) as AgentEvent;
            setEvents((prev) => [...prev, ev]);
            if (ev.type === "start" && typeof ev.conversationId === "string") {
              setConversationId(ev.conversationId);
            }
          } catch {
            // skip malformed frames
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setEvents((prev) => [
        ...prev,
        { type: "error", message: (e as Error).message },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-green-300 font-mono p-6">
      <h1 className="text-xl mb-4">/test-chat — kali agent SSE diagnostic</h1>

      <section className="mb-4">
        <div className="text-xs text-green-500 mb-2">sample queries:</div>
        <ul className="text-xs space-y-1">
          {SAMPLE_QUERIES.map((q, i) => (
            <li key={i}>
              <button
                onClick={() => setQuery(q)}
                className="text-left hover:text-green-100 underline-offset-2 hover:underline"
              >
                [{i + 1}] {q}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <textarea
          className="w-full bg-zinc-900 text-green-200 p-3 rounded border border-zinc-700 font-mono text-sm"
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-2 mt-2 items-center">
          <button
            onClick={send}
            disabled={running || !query.trim()}
            className="bg-green-700 text-black px-4 py-2 disabled:opacity-50"
          >
            {running ? "streaming…" : "send"}
          </button>
          <button
            onClick={() => {
              abortRef.current?.abort();
              setRunning(false);
            }}
            disabled={!running}
            className="bg-zinc-800 text-green-300 px-4 py-2 disabled:opacity-30"
          >
            abort
          </button>
          <button
            onClick={() => {
              setEvents([]);
              setConversationId(null);
            }}
            className="bg-zinc-800 text-green-300 px-4 py-2"
          >
            clear
          </button>
          <span className="text-xs text-green-500 ml-auto">
            {conversationId ? `conv: ${conversationId}` : "no conversation"}
          </span>
        </div>
      </section>

      <section className="space-y-2">
        {events.length === 0 && (
          <div className="text-zinc-500 text-sm">no events yet</div>
        )}
        {events.map((ev, i) => (
          <pre
            key={i}
            className={`text-xs p-2 rounded border whitespace-pre-wrap break-words ${
              ev.type === "tool_call"
                ? "border-blue-700 bg-blue-950/40 text-blue-200"
                : ev.type === "tool_result"
                  ? (ev as { isError?: boolean }).isError
                    ? "border-red-700 bg-red-950/40 text-red-200"
                    : "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                  : ev.type === "text"
                    ? "border-yellow-700 bg-yellow-950/40 text-yellow-200"
                    : ev.type === "done"
                      ? "border-green-700 bg-green-950/40 text-green-100"
                      : ev.type === "error"
                        ? "border-red-700 bg-red-950/40 text-red-200"
                        : "border-zinc-700 bg-zinc-900 text-green-300"
            }`}
          >
            {`[${ev.type}] ${JSON.stringify(ev, null, 2)}`}
          </pre>
        ))}
      </section>
    </main>
  );
}
