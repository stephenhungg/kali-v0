/**
 * Integration tests for /api/conversations/:id (GET + DELETE).
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  appendMessage,
  createConversation,
  __resetConversations,
} from "@/lib/agent/conversations";
import { DELETE, GET } from "./route";

afterEach(() => __resetConversations());

function req() {
  return new Request("http://localhost/x");
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/conversations/:id", () => {
  test("returns the full conversation with messages", async () => {
    const c = createConversation({ id: "fixed", title: "test" });
    appendMessage({ conversationId: c.id, role: "user", content: "hi" });
    appendMessage({
      conversationId: c.id,
      role: "assistant",
      content: "hello",
      toolCalls: [
        {
          name: "bloomerang.searchDonors",
          input: {},
          result: {},
          isError: false,
          durationMs: 1,
        },
      ],
      citations: ["ppl_1"],
    });

    const res = await GET(req(), ctxFor("fixed"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      conversation: {
        id: string;
        title: string;
        messages: Array<{
          role: string;
          content: string;
          toolCalls?: Array<{ name: string }>;
          citations?: string[];
        }>;
      };
    };
    expect(body.conversation.id).toBe("fixed");
    expect(body.conversation.messages).toHaveLength(2);
    expect(body.conversation.messages[1].toolCalls).toHaveLength(1);
    expect(body.conversation.messages[1].citations).toEqual(["ppl_1"]);
  });

  test("returns 404 for unknown id", async () => {
    const res = await GET(req(), ctxFor("ghost"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not found");
  });
});

describe("DELETE /api/conversations/:id", () => {
  test("removes the conversation and returns deleted id", async () => {
    const c = createConversation({ id: "to-delete" });
    const res = await DELETE(req(), ctxFor(c.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: string };
    expect(body.deleted).toBe("to-delete");

    // GET after DELETE should 404
    const after = await GET(req(), ctxFor(c.id));
    expect(after.status).toBe(404);
  });

  test("returns 404 for unknown id", async () => {
    const res = await DELETE(req(), ctxFor("ghost"));
    expect(res.status).toBe(404);
  });
});
