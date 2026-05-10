"use client";

/**
 * Client-side SSE consumer for POST /api/chat.
 *
 * The backend (lib/agent/stream.ts) emits framed events with `event: <type>`
 * + `data: <json>` lines per the SSE spec. We use fetch + ReadableStream
 * (not EventSource — that's GET-only) and buffer until each blank-line
 * boundary, then parse the JSON.
 *
 * Event protocol (mirrors lib/agent/stream::AgentEvent):
 *   start         → set conversationId
 *   tool_call     → row added to the per-message tool-call ledger (running)
 *   tool_result   → row finalized with result + duration + isError
 *   text          → final answer text drops in (whole, not streamed token-by-token)
 *   done          → totals + citations[] + citationsCited[] for chip rendering
 *   error         → assistant message gets an error banner
 *
 * Source-pulse: each `tool_call` triggers a 1.2s pulse on the matching
 * connector tile via the connector-map.
 */

import { useCallback, useRef, useState } from "react";
import { connectorForTool, type ConnectorId } from "../lib/agent/connector-map";

export interface ToolCallRow {
  id: string;
  name: string;
  input: unknown;
  result?: unknown;
  isError?: boolean;
  durationMs?: number;
  status: "running" | "done" | "error";
  startedAt: number;
}

export interface AgentStats {
  iterations: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  durationMs: number;
  done: boolean;
}

export interface CitationCited {
  n: number;
  kali_entity_id: string;
}

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      streaming: boolean;
      toolCalls: ToolCallRow[];
      /** All kali_entity_ids surfaced by tool calls. */
      citations: string[];
      /** [N] → kali_entity_id, only the ones actually referenced in the answer prose. */
      citationsCited: CitationCited[];
      stats: AgentStats;
      error?: string;
    };

interface PulseState {
  /** connector id → expiry timestamp (ms epoch) */
  activeUntil: Record<string, number>;
  /** connector id → total session calls */
  callCount: Record<string, number>;
}

const PULSE_DURATION_MS = 1200;
const newId = () => `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const initialStats = (): AgentStats => ({
  iterations: 0,
  toolCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  durationMs: 0,
  done: false,
});

export function useAgentStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pulse, setPulse] = useState<PulseState>({ activeUntil: {}, callCount: {} });
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const triggerPulse = useCallback((connector: ConnectorId) => {
    if (connector === "_meta") return;
    const expiry = Date.now() + PULSE_DURATION_MS;
    setPulse(prev => ({
      activeUntil: { ...prev.activeUntil, [connector]: expiry },
      callCount: { ...prev.callCount, [connector]: (prev.callCount[connector] ?? 0) + 1 },
    }));
    const existing = pulseTimers.current.get(connector);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setPulse(prev => {
        if ((prev.activeUntil[connector] ?? 0) <= Date.now()) {
          const { [connector]: _omit, ...rest } = prev.activeUntil;
          return { ...prev, activeUntil: rest };
        }
        return prev;
      });
    }, PULSE_DURATION_MS + 50);
    pulseTimers.current.set(connector, t);
  }, []);

  const send = useCallback(async (userText: string) => {
    if (streaming) return;
    if (!userText.trim()) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", text: userText };
    const assistantMsg: ChatMessage = {
      id: newId(),
      role: "assistant",
      text: "",
      streaming: true,
      toolCalls: [],
      citations: [],
      citationsCited: [],
      stats: initialStats(),
    };
    const aId = assistantMsg.id;

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          conversationId: conversationId ?? undefined,
          tenantId: "rivertown",
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "request failed");
        throw new Error(`/api/chat ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are delimited by blank lines.
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLines = raw
            .split("\n")
            .filter(l => l.startsWith("data: "))
            .map(l => l.slice(6));
          if (dataLines.length === 0) continue;
          try {
            const ev = JSON.parse(dataLines.join(""));
            applyEvent(aId, ev);
          } catch {
            // ignore malformed frames
          }
        }
      }
    } catch (e: any) {
      const errMsg = e?.name === "AbortError" ? "stopped" : (e?.message ?? "stream failed");
      setMessages(prev => prev.map(m =>
        m.id === aId && m.role === "assistant"
          ? { ...m, streaming: false, error: errMsg, stats: { ...m.stats, done: true } }
          : m
      ));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }

    function applyEvent(targetId: string, ev: any) {
      // Events that don't target a specific message
      if (ev.type === "start" && typeof ev.conversationId === "string") {
        setConversationId(ev.conversationId);
        return;
      }

      setMessages(prev => prev.map(m => {
        if (m.id !== targetId || m.role !== "assistant") return m;

        switch (ev.type) {
          case "tool_call": {
            const conn = connectorForTool(ev.name);
            queueMicrotask(() => triggerPulse(conn));
            const row: ToolCallRow = {
              id: ev.id,
              name: ev.name,
              input: ev.input,
              status: "running",
              startedAt: Date.now(),
            };
            return { ...m, toolCalls: [...m.toolCalls, row] };
          }

          case "tool_result": {
            const updated = m.toolCalls.map(t =>
              t.id === ev.id
                ? {
                    ...t,
                    result: ev.result,
                    isError: ev.isError,
                    durationMs: ev.durationMs,
                    status: ev.isError ? ("error" as const) : ("done" as const),
                  }
                : t
            );
            return {
              ...m,
              toolCalls: updated,
              stats: { ...m.stats, toolCalls: m.stats.toolCalls + 1 },
            };
          }

          case "text":
            return { ...m, text: typeof ev.text === "string" ? ev.text : m.text };

          case "done": {
            return {
              ...m,
              text: typeof ev.answer === "string" && ev.answer.length > m.text.length ? ev.answer : m.text,
              streaming: false,
              citations: Array.isArray(ev.citations) ? ev.citations : [],
              citationsCited: Array.isArray(ev.citationsCited) ? ev.citationsCited : [],
              stats: {
                iterations: ev.iterations ?? m.stats.iterations,
                toolCalls: m.stats.toolCalls,
                inputTokens: ev.totalInputTokens ?? m.stats.inputTokens,
                outputTokens: ev.totalOutputTokens ?? m.stats.outputTokens,
                cachedInputTokens: ev.cachedInputTokens ?? m.stats.cachedInputTokens,
                durationMs: ev.totalDurationMs ?? m.stats.durationMs,
                done: true,
              },
            };
          }

          case "error":
            return {
              ...m,
              streaming: false,
              error: ev.message ?? "agent error",
              stats: { ...m.stats, done: true },
            };

          default:
            return m;
        }
      }));
    }
  }, [streaming, conversationId, triggerPulse]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPulse({ activeUntil: {}, callCount: {} });
    setConversationId(null);
  }, []);

  /**
   * Hydrate the chat from a saved conversation. Fetches GET /api/chat?conversationId=…
   * and rebuilds the local ChatMessage[] from persisted user + assistant
   * turns (tool calls + citations included). Subsequent `send()` calls
   * continue this thread.
   */
  const loadConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    try {
      const res = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`load ${res.status}`);
      const data = await res.json();
      const conv = data.conversation;
      if (!conv) throw new Error("missing conversation");

      const rebuilt: ChatMessage[] = [];
      for (const m of conv.messages ?? []) {
        if (m.role === "user") {
          rebuilt.push({ id: m.id, role: "user", text: m.content });
        } else if (m.role === "assistant") {
          const toolCalls: ToolCallRow[] = (m.toolCalls ?? []).map((tc: any, i: number) => ({
            id: `${m.id}_tc_${i}`,
            name: tc.name,
            input: tc.input,
            result: tc.result,
            isError: !!tc.isError,
            durationMs: tc.durationMs ?? 0,
            status: tc.isError ? "error" : "done",
            startedAt: 0,
          }));
          rebuilt.push({
            id: m.id,
            role: "assistant",
            text: m.content,
            streaming: false,
            toolCalls,
            citations: m.citations ?? [],
            citationsCited: [], // NOTE: citationsCited isn't persisted; chips re-resolve from text vs citations
            stats: {
              iterations: 0,
              toolCalls: toolCalls.length,
              inputTokens: 0,
              outputTokens: 0,
              cachedInputTokens: 0,
              durationMs: toolCalls.reduce((s: number, t: ToolCallRow) => s + (t.durationMs ?? 0), 0),
              done: true,
            },
            error: m.content?.startsWith("[error]") ? m.content : undefined,
          });
        }
        // tool-role messages are skipped (we don't render them separately)
      }

      setMessages(rebuilt);
      setConversationId(conv.id);
      setPulse({ activeUntil: {}, callCount: {} });
    } catch {
      // Silent failure — caller can show a toast if needed
    }
  }, []);

  return { messages, streaming, pulse, conversationId, send, stop, reset, loadConversation };
}
