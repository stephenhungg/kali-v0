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
  getConversation,
  getOrCreateConversation,
  updateMessage,
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

  const { conversation } = await getOrCreateConversation(body.conversationId, {
    tenantId: body.tenantId,
    userId: body.userId,
    title: body.title,
  });

  // Snapshot the existing turns BEFORE we append the new user message — these
  // become the agent's seed history so it answers in the context of the whole
  // conversation, not just the latest query.
  const priorMessages = conversation.messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  await appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: body.query,
  });

  const stream = runStream({
    apiKey,
    query: body.query,
    priorMessages,
    tenantId: conversation.tenantId,
    userId: conversation.userId,
    conversationId: conversation.id,
  });

  // Persist incrementally so a client disconnect mid-stream still leaves
  // the assistant turn on disk:
  //   - on `text`: appendMessage with the answer + accumulated toolCalls.
  //                we save the message id so we can update it later.
  //   - on `done`: updateMessage to attach the final citations array.
  //   - on `error`: append a [error] assistant message if we never got
  //                 to `text`. If we DID, leave the persisted answer alone
  //                 and just append a separate error note.
  const persisted: {
    toolCalls: NonNullable<ConversationMessage["toolCalls"]>;
    assistantMessageId: string | null;
  } = { toolCalls: [], assistantMessageId: null };
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
        case "text": {
          const msg = await appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: ev.text,
            toolCalls: persisted.toolCalls,
            citations: [],
          });
          persisted.assistantMessageId = msg.id;
          break;
        }
        case "done":
          if (persisted.assistantMessageId) {
            await updateMessage({
              conversationId: conversation.id,
              messageId: persisted.assistantMessageId,
              toolCalls: persisted.toolCalls,
              citations: ev.citations,
            });
          } else {
            // No `text` ever fired (model returned empty content array,
            // for instance). Persist whatever we have so the conversation
            // still records the run.
            await appendMessage({
              conversationId: conversation.id,
              role: "assistant",
              content: ev.answer || "(empty response)",
              toolCalls: persisted.toolCalls,
              citations: ev.citations,
            });
          }
          break;
        case "error":
          await appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: `[error] ${ev.message}`,
            toolCalls: persisted.toolCalls,
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
  if (!id || id.length === 0)
    return NextResponse.json(
      { error: "missing conversationId" },
      { status: 400 },
    );
  // Pure read — no get-or-create side effect. Unknown id → 404.
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}
