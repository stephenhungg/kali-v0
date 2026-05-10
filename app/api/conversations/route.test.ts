/**
 * Integration tests for /api/conversations (list + create).
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  appendMessage,
  __resetConversations,
} from "@/lib/agent/conversations";
import { GET, POST } from "./route";

afterEach(() => __resetConversations());

function req(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("POST /api/conversations", () => {
  test("creates an empty conversation with defaults", async () => {
    const res = await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      tenantId: string;
      userId: string;
      title: string | null;
      messageCount: number;
    };
    expect(body.id).toMatch(/^conv_/);
    expect(body.tenantId).toBe("rivertown");
    expect(body.userId).toBe("demo");
    expect(body.title).toBeNull();
    expect(body.messageCount).toBe(0);
  });

  test("respects explicit tenantId / userId / title", async () => {
    const res = await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          tenantId: "alpha",
          userId: "u_x",
          title: "Custom title",
        }),
      }),
    );
    const body = (await res.json()) as {
      tenantId: string;
      userId: string;
      title: string;
    };
    expect(body.tenantId).toBe("alpha");
    expect(body.userId).toBe("u_x");
    expect(body.title).toBe("Custom title");
  });

  test("empty/invalid JSON body still creates with defaults", async () => {
    const res = await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe("GET /api/conversations", () => {
  test("returns empty list when no conversations", async () => {
    const res = await GET(req("http://localhost/api/conversations"));
    const body = (await res.json()) as { count: number; conversations: unknown[] };
    expect(body.count).toBe(0);
    expect(body.conversations).toHaveLength(0);
  });

  test("returns both conversations with correct messageCount", async () => {
    const a = await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "older" }),
      }),
    );
    const aBody = (await a.json()) as { id: string };
    appendMessage({ conversationId: aBody.id, role: "user", content: "hi" });
    appendMessage({ conversationId: aBody.id, role: "user", content: "again" });

    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "newer" }),
      }),
    );

    const res = await GET(req("http://localhost/api/conversations"));
    const body = (await res.json()) as {
      count: number;
      conversations: Array<{ title: string | null; messageCount: number }>;
    };
    expect(body.count).toBe(2);
    const titles = body.conversations.map((c) => c.title).sort();
    expect(titles).toEqual(["newer", "older"]);
    const older = body.conversations.find((c) => c.title === "older")!;
    expect(older.messageCount).toBe(2);
  });

  test("orders by updatedAt desc when timestamps are distinct", async () => {
    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "first" }),
      }),
    );
    // Wait long enough that the next createdAt differs at ms resolution.
    await new Promise((r) => setTimeout(r, 5));
    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "second" }),
      }),
    );
    const res = await GET(req("http://localhost/api/conversations"));
    const body = (await res.json()) as {
      conversations: Array<{ title: string | null }>;
    };
    expect(body.conversations[0].title).toBe("second");
    expect(body.conversations[1].title).toBe("first");
  });

  test("filters by tenantId / userId", async () => {
    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ tenantId: "alpha" }),
      }),
    );
    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({ tenantId: "beta" }),
      }),
    );

    const a = await GET(req("http://localhost/api/conversations?tenantId=alpha"));
    const aBody = (await a.json()) as { count: number };
    expect(aBody.count).toBe(1);

    const b = await GET(req("http://localhost/api/conversations?tenantId=beta"));
    const bBody = (await b.json()) as { count: number };
    expect(bBody.count).toBe(1);
  });

  test("limit param is clamped between 1 and 200", async () => {
    for (let i = 0; i < 3; i++) {
      await POST(
        req("http://localhost/api/conversations", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
    }
    const res = await GET(req("http://localhost/api/conversations?limit=2"));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(2);
  });

  test("non-numeric limit falls back to default (no NaN-induced empty results)", async () => {
    for (let i = 0; i < 3; i++) {
      await POST(
        req("http://localhost/api/conversations", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
    }
    const res = await GET(req("http://localhost/api/conversations?limit=abc"));
    const body = (await res.json()) as { count: number };
    // With NaN, the old code did slice(0, NaN) = []. The fix returns the
    // default (50), so all 3 should come back.
    expect(body.count).toBe(3);
  });

  test("empty limit string also falls back to default", async () => {
    await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const res = await GET(req("http://localhost/api/conversations?limit="));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(1);
  });

  test("strips messages from the list response (count only)", async () => {
    const c = await POST(
      req("http://localhost/api/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const cBody = (await c.json()) as { id: string };
    appendMessage({ conversationId: cBody.id, role: "user", content: "x" });

    const res = await GET(req("http://localhost/api/conversations"));
    const body = (await res.json()) as {
      conversations: Array<{ messages?: unknown }>;
    };
    expect(body.conversations[0].messages).toBeUndefined();
  });
});
