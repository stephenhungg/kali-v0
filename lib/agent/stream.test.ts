/**
 * Tests for the streamed agent run.
 *
 * Uses a stubbed Anthropic fetch so we don't hit the live API. The stub
 * scripts a two-turn conversation: tool_use → tool_result → end_turn.
 */

import { describe, expect, test } from "bun:test";
import { runStream, toSSE, type AgentEvent } from "./stream";

interface StubResponse {
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

function makeStubFetch(scripted: StubResponse[]) {
  let i = 0;
  return async () => {
    if (i >= scripted.length) {
      throw new Error("stub: unexpected extra call");
    }
    return scripted[i++];
  };
}

describe("runStream", () => {
  test("emits start → tool_call → tool_result → text → done", async () => {
    const stub = makeStubFetch([
      {
        id: "msg_a",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "bloomerang.searchDonors",
            input: { segment: "lapsed", limit: 3 },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 20 },
      },
      {
        id: "msg_b",
        role: "assistant",
        content: [
          { type: "text", text: "Found 3 lapsed donors. [1][2][3]" },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 200, output_tokens: 40, cache_read_input_tokens: 80 },
      },
    ]);

    const events: AgentEvent[] = [];
    for await (const ev of runStream({
      apiKey: "test",
      query: "find lapsed donors",
      conversationId: "conv_test",
      fetch: stub,
    })) {
      events.push(ev);
    }

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("start");
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types).toContain("text");
    expect(types[types.length - 1]).toBe("done");

    const done = events.find((e) => e.type === "done") as Extract<
      AgentEvent,
      { type: "done" }
    >;
    expect(done.iterations).toBe(2);
    expect(done.cachedInputTokens).toBe(80);
    expect(done.answer).toContain("lapsed donors");
    expect(done.citations.length).toBeGreaterThan(0);
  });

  test("tool_call event fires BEFORE tool_result for the same id", async () => {
    const stub = makeStubFetch([
      {
        id: "msg_a",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "bloomerang.searchDonors",
            input: { limit: 1 },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      {
        id: "msg_b",
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);

    let callIdx = -1;
    let resultIdx = -1;
    let i = 0;
    for await (const ev of runStream({
      apiKey: "test",
      query: "x",
      fetch: stub,
    })) {
      if (ev.type === "tool_call" && ev.id === "tool_1") callIdx = i;
      if (ev.type === "tool_result" && ev.id === "tool_1") resultIdx = i;
      i++;
    }
    expect(callIdx).toBeGreaterThanOrEqual(0);
    expect(resultIdx).toBeGreaterThan(callIdx);
  });

  test("yields parallel tool_call events when one turn invokes multiple tools", async () => {
    const stub = makeStubFetch([
      {
        id: "msg_a",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "bloomerang.searchDonors",
            input: { limit: 1 },
          },
          {
            type: "tool_use",
            id: "tool_2",
            name: "salesforce.searchContacts",
            input: { isBoard: true, limit: 1 },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      {
        id: "msg_b",
        role: "assistant",
        content: [{ type: "text", text: "done" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);

    const callNames: string[] = [];
    for await (const ev of runStream({
      apiKey: "test",
      query: "x",
      fetch: stub,
    })) {
      if (ev.type === "tool_call") callNames.push(ev.name);
    }
    expect(callNames).toEqual([
      "bloomerang.searchDonors",
      "salesforce.searchContacts",
    ]);
  });

  test("yields error event when a tool throws (handler-level error)", async () => {
    const stub = makeStubFetch([
      {
        id: "msg_a",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            // unknown tool name → handler throws
            name: "doesnotexist.tool",
            input: {},
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      {
        id: "msg_b",
        role: "assistant",
        content: [{ type: "text", text: "fallback" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);

    const events: AgentEvent[] = [];
    for await (const ev of runStream({
      apiKey: "test",
      query: "x",
      fetch: stub,
    })) {
      events.push(ev);
    }
    const result = events.find(
      (e) => e.type === "tool_result",
    ) as Extract<AgentEvent, { type: "tool_result" }>;
    expect(result.isError).toBe(true);
    expect(String(result.result)).toContain("unknown tool");
  });

  test("emits error and stops when Anthropic call throws", async () => {
    const stub = async () => {
      throw new Error("boom");
    };
    const events: AgentEvent[] = [];
    for await (const ev of runStream({
      apiKey: "test",
      query: "x",
      fetch: stub,
    })) {
      events.push(ev);
    }
    const err = events.find((e) => e.type === "error") as Extract<
      AgentEvent,
      { type: "error" }
    >;
    expect(err).toBeDefined();
    expect(err.message).toContain("boom");
  });
});

describe("toSSE", () => {
  test("formats events as SSE frames", async () => {
    async function* events(): AsyncGenerator<AgentEvent> {
      yield { type: "start", conversationId: "conv_x" };
      yield { type: "text", text: "hi" };
    }
    const out: string[] = [];
    for await (const frame of toSSE(events())) out.push(frame);
    expect(out[0]).toContain("event: start");
    expect(out[0]).toContain("conv_x");
    expect(out[0]).toMatch(/\n\n$/);
    expect(out[1]).toContain("event: text");
  });
});
