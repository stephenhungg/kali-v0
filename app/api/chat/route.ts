/**
 * POST /api/chat
 *
 * Streams an agent run as Server-Sent Events:
 *   - event: start          { conversationId }
 *   - event: tool_call      { id, name, input }
 *   - event: tool_result    { id, name, result, isError, durationMs }
 *   - event: text           { text }              ← final answer body
 *   - event: done           { iterations, totals, citations, answer }
 *   - event: error          { message }
 *
 * Body:
 *   { query: string, conversationId?: string, tenantId?: string,
 *     userId?: string, title?: string }
 *
 * Persists the user message + assistant response (with tool calls + citations)
 * into the in-memory conversation store. Production swaps to the Drizzle
 * `conversations` / `messages` tables.
 */

import { NextResponse } from "next/server";
import {
  appendMessage,
  getOrCreateConversation,
  type ConversationMessage,
} from "@/lib/agent/conversations";
import {
  runStream,
  toReadableStream,
  toSSE,
  type AgentEvent,
} from "@/lib/agent/stream";

export const runtime = "nodejs";

interface ChatRequestBody {
  query: string;
  conversationId?: string;
  tenantId?: string;
  userId?: string;
  title?: string;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "missing 'query'" }, { status: 400 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  const { conversation } = getOrCreateConversation(body.conversationId, {
    tenantId: body.tenantId,
    userId: body.userId,
    title: body.title,
  });

  appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: body.query,
  });

  const stream = runStream({
    apiKey,
    query: body.query,
    tenantId: conversation.tenantId,
    userId: conversation.userId,
    conversationId: conversation.id,
  });

  // Tee the stream — one branch is forwarded as SSE to the client, the
  // other accumulates into the conversation store.
  const persisted: {
    answer: string;
    toolCalls: NonNullable<ConversationMessage["toolCalls"]>;
    citations: string[];
  } = { answer: "", toolCalls: [], citations: [] };
  const inProgressById = new Map<string, { name: string; input: unknown }>();

  async function* tap() {
    for await (const ev of stream as AsyncGenerator<AgentEvent>) {
      switch (ev.type) {
        case "tool_call":
          inProgressById.set(ev.id, { name: ev.name, input: ev.input });
          break;
        case "tool_result": {
          const start = inProgressById.get(ev.id);
          inProgressById.delete(ev.id);
          persisted.toolCalls.push({
            name: ev.name,
            input: start?.input,
            result: ev.result,
            isError: ev.isError,
            durationMs: ev.durationMs,
          });
          break;
        }
        case "text":
          persisted.answer = ev.text;
          break;
        case "done":
          persisted.citations = ev.citations;
          appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: persisted.answer,
            toolCalls: persisted.toolCalls,
            citations: persisted.citations,
          });
          break;
        case "error":
          appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: `[error] ${ev.message}`,
          });
          break;
      }
      yield ev;
    }
  }

  const sse = toSSE(tap() as AsyncGenerator<AgentEvent>);
  return new Response(toReadableStream(sse), {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

/**
 * GET /api/chat?conversationId=…
 *
 * Returns the persisted message history for a conversation. Used by the
 * UI to hydrate when the user reopens a chat.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("conversationId");
  if (!id)
    return NextResponse.json(
      { error: "missing conversationId" },
      { status: 400 },
    );
  const { conversation, created } = getOrCreateConversation(id);
  if (created) {
    // We auto-create on get-or-create; for the GET semantics, return 404 for
    // unknown ids instead.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}
