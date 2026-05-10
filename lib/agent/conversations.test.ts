import { afterEach, describe, expect, test } from "bun:test";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getConversation,
  getOrCreateConversation,
  listConversations,
  __conversationsCount,
  __resetConversations,
} from "./conversations";

afterEach(() => __resetConversations());

describe("createConversation", () => {
  test("returns a conversation with defaults filled in", () => {
    const c = createConversation();
    expect(c.id).toMatch(/^conv_/);
    expect(c.tenantId).toBe("rivertown");
    expect(c.userId).toBe("demo");
    expect(c.messages).toHaveLength(0);
  });

  test("respects explicit id + tenantId/userId/title", () => {
    const c = createConversation({
      id: "fixed",
      tenantId: "alpha",
      userId: "u1",
      title: "Why I love Kali",
    });
    expect(c.id).toBe("fixed");
    expect(c.tenantId).toBe("alpha");
    expect(c.title).toBe("Why I love Kali");
  });
});

describe("getConversation / getOrCreateConversation", () => {
  test("getConversation returns null for unknown id", () => {
    expect(getConversation("nope")).toBeNull();
  });

  test("getOrCreate returns existing when id matches", () => {
    const a = createConversation({ id: "fixed" });
    const r = getOrCreateConversation("fixed");
    expect(r.created).toBe(false);
    expect(r.conversation).toBe(a);
  });

  test("getOrCreate creates when id missing", () => {
    const r = getOrCreateConversation(undefined);
    expect(r.created).toBe(true);
    expect(__conversationsCount()).toBe(1);
  });

  test("getOrCreate creates with the provided id when unknown", () => {
    const r = getOrCreateConversation("brand-new");
    expect(r.created).toBe(true);
    expect(r.conversation.id).toBe("brand-new");
  });
});

describe("appendMessage", () => {
  test("appends a message and updates updatedAt", () => {
    const c = createConversation();
    const before = c.updatedAt;
    // Make sure the timestamp moves forward by sleeping a tick.
    const m = appendMessage({
      conversationId: c.id,
      role: "user",
      content: "hello",
    });
    expect(m.id).toMatch(/^msg_/);
    expect(m.role).toBe("user");
    expect(c.messages).toHaveLength(1);
    expect(c.updatedAt >= before).toBe(true);
  });

  test("auto-titles from the first user message when none set", () => {
    const c = createConversation();
    appendMessage({
      conversationId: c.id,
      role: "user",
      content: "Find lapsed donors who attended the spring gala",
    });
    expect(c.title).toBe("Find lapsed donors who attended the spring gala");
  });

  test("does not overwrite an explicit title", () => {
    const c = createConversation({ title: "preset" });
    appendMessage({
      conversationId: c.id,
      role: "user",
      content: "anything",
    });
    expect(c.title).toBe("preset");
  });

  test("stores toolCalls + citations on assistant messages", () => {
    const c = createConversation();
    appendMessage({ conversationId: c.id, role: "user", content: "q" });
    const a = appendMessage({
      conversationId: c.id,
      role: "assistant",
      content: "answer",
      toolCalls: [
        {
          name: "bloomerang.searchDonors",
          input: { segment: "lapsed" },
          result: { count: 3 },
          isError: false,
          durationMs: 4,
        },
      ],
      citations: ["ppl_1", "ppl_2"],
    });
    expect(a.toolCalls).toHaveLength(1);
    expect(a.citations).toEqual(["ppl_1", "ppl_2"]);
  });

  test("throws on unknown conversation id", () => {
    expect(() =>
      appendMessage({
        conversationId: "ghost",
        role: "user",
        content: "x",
      }),
    ).toThrow();
  });
});

describe("listConversations", () => {
  test("filters by tenantId / userId, sorted by updatedAt desc", () => {
    const a = createConversation({ tenantId: "x", userId: "u" });
    const b = createConversation({ tenantId: "x", userId: "u" });
    const c = createConversation({ tenantId: "y", userId: "u" });
    appendMessage({ conversationId: a.id, role: "user", content: "1" });
    appendMessage({ conversationId: b.id, role: "user", content: "2" });
    const xList = listConversations({ tenantId: "x" });
    expect(xList.length).toBe(2);
    expect(xList[0].updatedAt >= xList[1].updatedAt).toBe(true);
    const yList = listConversations({ tenantId: "y" });
    expect(yList.map((c) => c.id)).toContain(c.id);
  });
});

describe("deleteConversation", () => {
  test("removes the conversation", () => {
    const c = createConversation();
    expect(deleteConversation(c.id)).toBe(true);
    expect(getConversation(c.id)).toBeNull();
  });

  test("returns false for unknown id", () => {
    expect(deleteConversation("ghost")).toBe(false);
  });
});
