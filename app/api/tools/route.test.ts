/**
 * Integration tests for GET /api/tools.
 *
 * Calls the route handler directly (no HTTP server needed) using a
 * NextRequest stub.
 */

import { describe, expect, test } from "bun:test";
import { GET } from "./route";

function nextReq(url: string) {
  return new Request(url) as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/tools", () => {
  test("returns every tool with name + description + source", async () => {
    const res = await GET(nextReq("http://localhost/api/tools"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      tools: Array<{
        name: string;
        description: string;
        source: string | null;
        sourceLabel: string | null;
        input_schema: Record<string, unknown>;
      }>;
    };
    expect(body.total).toBeGreaterThan(60);
    expect(body.tools.length).toBe(body.total);
    for (const t of body.tools) {
      expect(t.name).toMatch(/^[a-z0-9_]+\.[a-zA-Z0-9_]+$/);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.source).not.toBeNull();
      expect(t.input_schema).toBeDefined();
    }
  });

  test("filters by source", async () => {
    const res = await GET(nextReq("http://localhost/api/tools?source=bloomerang"));
    const body = (await res.json()) as { tools: { source: string }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    for (const t of body.tools) expect(t.source).toBe("bloomerang");
  });

  test("filters by domain", async () => {
    const res = await GET(nextReq("http://localhost/api/tools?domain=finance"));
    const body = (await res.json()) as { tools: { domain: string }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    for (const t of body.tools) expect(t.domain).toBe("finance");
  });

  test("compact=1 strips input_schema", async () => {
    const res = await GET(
      nextReq("http://localhost/api/tools?source=bloomerang&compact=1"),
    );
    const body = (await res.json()) as {
      tools: Array<{ name: string; input_schema?: unknown }>;
    };
    for (const t of body.tools) expect(t.input_schema).toBeUndefined();
  });

  test("unknown source filter returns zero", async () => {
    const res = await GET(nextReq("http://localhost/api/tools?source=doesnotexist"));
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(0);
  });
});
