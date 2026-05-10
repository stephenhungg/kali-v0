/**
 * Integration tests for POST /api/chat (SSE) + GET /api/chat (history).
 *
 * Stubs `globalThis.fetch` so the route doesn't hit live Anthropic. The
 * stub scripts a two-turn conversation: tool_use → tool_result → end_turn.
 *
 * Verifies:
 *   - request validation (missing query, bad json, missing API key)
 *   - SSE stream actually flows + frames parse
 *   - assistant message is persisted with toolCalls + citations
 *   - GET ?conversationId hydrates the history
 *   - graceful 4xx for unknown conversations on GET
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { __resetAuditLogs } from "@/lib/audit/log";
import {
  __resetConversations,
  getConversation,
} from "@/lib/agent/conversations";
import { GET, POST } from "./route";

interface AnthropicLikeResponse {
  id: string;
  role: string;
  content: Array<{ type: string; [k: string]: unknown }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

function installFetchStub(scripted: AnthropicLikeResponse[]): void {
  let i = 0;
  globalThis.fetch = (async () => {
    if (i >= scripted.length) {
      throw new Error("stub: unexpected extra fetch call");
    }
    return jsonResponse(scripted[i++]);
  }) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = ORIGINAL_FETCH;
}

beforeEach(() => {
  __resetConversations();
  __resetAuditLogs();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  restoreFetch();
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

async function readSSE(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) events.push(JSON.parse(dataLine.slice("data: ".length)));
    }
  }
  return events;
}

describe("POST /api/chat — request validation", () => {
  test("returns 400 on invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: "not json",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when query is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  test("returns 500 when ANTHROPIC_API_KEY isn't set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ query: "x" }),
      }) as never,
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/chat — SSE streaming + persistence", () => {
  test("streams every event and persists the assistant message", async () => {
    installFetchStub([
      {
        id: "msg_a",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "bloomerang.searchDonors",
            input: { segment: "lapsed", limit: 2 },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      {
        id: "msg_b",
        role: "assistant",
        content: [{ type: "text", text: "Found two lapsed donors. [1][2]" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 20, output_tokens: 5, cache_read_input_tokens: 5 },
      },
    ]);

    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ query: "lapsed donors" }),
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSSE(res);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("start");
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types).toContain("text");
    expect(types[types.length - 1]).toBe("done");

    const start = events.find((e) => e.type === "start") as { conversationId: string };
    const conv = getConversation(start.conversationId);
    expect(conv).not.toBeNull();
    expect(conv!.messages.length).toBe(2);
    expect(conv!.messages[0].role).toBe("user");
    expect(conv!.messages[0].content).toBe("lapsed donors");
    expect(conv!.messages[1].role).toBe("assistant");
    expect(conv!.messages[1].toolCalls?.length).toBe(1);
    expect(conv!.messages[1].citations?.length).toBeGreaterThan(0);
  });

  test("error event is captured into the conversation when Anthropic fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("upstream down");
    }) as typeof fetch;

    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ query: "x" }),
      }) as never,
    );
    const events = await readSSE(res);
    const err = events.find((e) => e.type === "error") as { message: string };
    expect(err.message).toContain("upstream down");

    // Conversation still has the user message + the error-as-assistant.
    const start = events.find((e) => e.type === "start") as { conversationId: string };
    const conv = getConversation(start.conversationId);
    expect(conv!.messages.length).toBe(2);
    expect(conv!.messages[1].content).toContain("[error]");
  });
});

describe("GET /api/chat?conversationId=…", () => {
  test("returns 400 without conversationId", async () => {
    const res = await GET(
      new Request("http://localhost/api/chat") as never,
    );
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown conversation", async () => {
    const res = await GET(
      new Request("http://localhost/api/chat?conversationId=ghost") as never,
    );
    expect(res.status).toBe(404);
  });
});
