/**
 * Streamed agent run.
 *
 * Wraps the same Anthropic tool-use loop as `runtime.ts::run()` but yields
 * structured events as it goes — tool calls, tool results, and the final
 * answer text. Powers the SSE chat endpoint and the source-pulse panel
 * animation in the chat UI.
 *
 * Shape of the stream (chronological):
 *   { type: "start", conversationId }
 *   { type: "tool_call", id, name, input }            // one per parallel call
 *   { type: "tool_result", id, name, result, isError, durationMs }
 *   ...repeats per turn until end_turn...
 *   { type: "text", text }                             // final answer (whole)
 *   { type: "done", iterations, totals, citations }
 *   { type: "error", message }                         // on failure
 */

import { listTools } from "../connectors/registry";
import { makeToolContext } from "../audit/log";
import "./registrations";
import { toAnthropicTools } from "./runtime";
import { resolveCitedNumbers } from "./citations";

const MODEL = "claude-sonnet-4-6";
const API_VERSION = "2023-06-01";
const MAX_ITERATIONS = 20;
const MAX_TOKENS = 4096;

/* ─── system prompt — re-exported from runtime for symmetry ───────────── */
export { SYSTEM_PROMPT } from "./runtime";

/* ─── event types ─────────────────────────────────────────────────────── */

export type AgentEvent =
  | { type: "start"; conversationId: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      id: string;
      name: string;
      result: unknown;
      isError: boolean;
      durationMs: number;
    }
  | { type: "text"; text: string }
  | {
      type: "done";
      conversationId: string;
      iterations: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      cachedInputTokens: number;
      totalDurationMs: number;
      /** Every kali_entity_id surfaced by tool calls during the run. */
      citations: string[];
      /**
       * The subset of `citations` actually referenced by `[N]` markers in
       * the final answer, with their 1-based index. Frontend uses this to
       * render exactly the chips that appear inline in the prose.
       */
      citationsCited: Array<{ n: number; kali_entity_id: string }>;
      answer: string;
    }
  | { type: "error"; message: string };

export interface StreamRunOptions {
  apiKey: string;
  query: string;
  tenantId?: string;
  userId?: string;
  conversationId?: string;
  /**
   * Override the Anthropic HTTP call. Used by tests + benchmarks. The
   * function receives the request body and returns a fake `Response`-like
   * object's `.json()` payload directly.
   */
  fetch?: (body: unknown) => Promise<unknown>;
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

interface Block {
  type: "text" | "tool_use" | "tool_result";
  [key: string]: unknown;
}
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Block[];
}
interface AnthropicResponse {
  id: string;
  role: string;
  content: Block[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

async function callAnthropic(
  apiKey: string,
  messages: AnthropicMessage[],
  tools: ReturnType<typeof toAnthropicTools>,
  fetchOverride?: (body: unknown) => Promise<unknown>,
): Promise<AnthropicResponse> {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        // Late-bound: import at call time to avoid a circular dep between
        // stream.ts and runtime.ts at module-top.
        text: (await import("./runtime")).SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: tools.map((t, i) =>
      i === tools.length - 1
        ? { ...t, cache_control: { type: "ephemeral" } }
        : t,
    ),
    messages,
  };
  if (fetchOverride) {
    return (await fetchOverride(body)) as AnthropicResponse;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  return (await res.json()) as AnthropicResponse;
}

/* ─── the streaming run ───────────────────────────────────────────────── */

export async function* runStream(
  opts: StreamRunOptions,
): AsyncGenerator<AgentEvent, void, void> {
  const t0 = Date.now();
  const conversationId =
    opts.conversationId ?? `conv_${Date.now().toString(36)}`;
  yield { type: "start", conversationId };

  try {
    const ctx = makeToolContext({
      tenantId: opts.tenantId ?? "rivertown",
      userId: opts.userId ?? "demo",
      conversationId,
    });
    const tools = listTools();
    const anthropicTools = toAnthropicTools(tools);
    const toolByName = new Map(tools.map((t) => [t.name, t] as const));

    const messages: AnthropicMessage[] = [
      { role: "user", content: opts.query },
    ];
    let totalInput = 0;
    let totalOutput = 0;
    let totalCached = 0;
    const citations = new Set<string>();
    let answer = "";

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const resp = await callAnthropic(
        opts.apiKey,
        messages,
        anthropicTools,
        opts.fetch,
      );
      totalInput += resp.usage.input_tokens;
      totalOutput += resp.usage.output_tokens;
      totalCached += resp.usage.cache_read_input_tokens ?? 0;
      messages.push({ role: "assistant", content: resp.content });

      // Treat both end_turn and max_tokens as terminal "the model said its
      // piece" — max_tokens means the answer was truncated, but the
      // accumulated text + tool calls + citations are still valid and we
      // should persist them. Throwing on max_tokens (the prior behavior)
      // dropped everything we already had.
      if (resp.stop_reason === "end_turn" || resp.stop_reason === "max_tokens") {
        answer = resp.content
          .filter((b) => b.type === "text")
          .map((b) => (b as unknown as { text: string }).text)
          .join("\n")
          .trim();
        if (answer.length > 0) {
          yield { type: "text", text: answer };
        }
        const citationsArr = Array.from(citations);
        yield {
          type: "done",
          conversationId,
          iterations: iter + 1,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          cachedInputTokens: totalCached,
          totalDurationMs: Date.now() - t0,
          citations: citationsArr,
          citationsCited: resolveCitedNumbers(answer, citationsArr),
          answer,
        };
        return;
      }
      if (resp.stop_reason !== "tool_use") {
        throw new Error(`unexpected stop_reason=${resp.stop_reason}`);
      }

      const toolUseBlocks = resp.content.filter(
        (b) => b.type === "tool_use",
      ) as Array<{ type: "tool_use"; id: string; name: string; input: unknown }>;

      // Yield tool_call events FIRST so the UI lights up tiles before the
      // handlers actually run.
      for (const block of toolUseBlocks) {
        yield {
          type: "tool_call",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }

      // Execute in parallel, but emit results in completion order.
      const results = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const tStart = Date.now();
          const tool = toolByName.get(block.name);
          try {
            if (!tool) throw new Error(`unknown tool: ${block.name}`);
            const validated = tool.input.parse(block.input);
            const out = await tool.handler(validated, ctx);
            const dur = Date.now() - tStart;
            // Best-effort citation harvest: anything kali_entity_id-shaped
            // in the output gets recorded.
            collectCitations(out, citations);
            return {
              id: block.id,
              name: block.name,
              result: out,
              isError: false,
              durationMs: dur,
            };
          } catch (e: unknown) {
            return {
              id: block.id,
              name: block.name,
              result: e instanceof Error ? e.message : String(e),
              isError: true,
              durationMs: Date.now() - tStart,
            };
          }
        }),
      );

      for (const r of results) {
        yield {
          type: "tool_result",
          id: r.id,
          name: r.name,
          result: r.result,
          isError: r.isError,
          durationMs: r.durationMs,
        };
      }

      messages.push({
        role: "user",
        content: results.map((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content:
            typeof r.result === "string"
              ? r.result
              : JSON.stringify(r.result).slice(0, 50_000),
          is_error: r.isError,
        })),
      });
    }
    yield {
      type: "error",
      message: `exceeded ${MAX_ITERATIONS} iterations without final answer`,
    };
  } catch (e: unknown) {
    yield {
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Walk an arbitrary JSON-ish value and pull out every `kali_entity_id` it
 * contains. Used to populate the `citations` set on the `done` event.
 */
function collectCitations(value: unknown, into: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") return;
  if (Array.isArray(value)) {
    for (const v of value) collectCitations(v, into);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.kali_entity_id === "string") into.add(obj.kali_entity_id);
    for (const v of Object.values(obj)) collectCitations(v, into);
  }
}

/**
 * Serialize an AgentEvent stream to Server-Sent Events lines (`data: …\n\n`
 * per event). The frontend's EventSource parses these directly.
 */
export async function* toSSE(
  stream: AsyncGenerator<AgentEvent>,
): AsyncGenerator<string> {
  for await (const event of stream) {
    yield `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }
}

/** Convert an AsyncGenerator<string> into a ReadableStream<Uint8Array>. */
export function toReadableStream(
  source: AsyncGenerator<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of source) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
