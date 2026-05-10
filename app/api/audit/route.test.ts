/**
 * Integration tests for GET /api/audit.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { getAuditLog, __resetAuditLogs } from "@/lib/audit/log";
import { GET } from "./route";

afterEach(() => __resetAuditLogs());

function req(url: string) {
  return new Request(url);
}

function seedAudit(tenantId: string) {
  const log = getAuditLog(tenantId);
  log.record({
    entry: {
      source: "bloomerang",
      toolName: "bloomerang.searchDonors",
      paramsHash: "h1",
      recordIds: ["ppl_1"],
      durationMs: 4,
    },
    userId: "u1",
    conversationId: "c1",
  });
  log.record({
    entry: {
      source: "salesforce",
      toolName: "salesforce.searchContacts",
      paramsHash: "h2",
      recordIds: ["ppl_2"],
      durationMs: 6,
    },
    userId: "u1",
    conversationId: "c1",
  });
  log.record({
    entry: {
      source: "bloomerang",
      toolName: "bloomerang.getDonor",
      paramsHash: "h3",
      recordIds: ["ppl_3"],
      durationMs: 3,
    },
    userId: "u1",
    conversationId: "c2",
  });
}

describe("GET /api/audit", () => {
  test("returns all entries for the default tenant", async () => {
    seedAudit("rivertown");
    const res = await GET(req("http://localhost/api/audit"));
    const body = (await res.json()) as {
      tenantId: string;
      total: number;
      entries: Array<{ source: string; toolName: string }>;
    };
    expect(body.tenantId).toBe("rivertown");
    expect(body.total).toBe(3);
    expect(body.entries).toHaveLength(3);
  });

  test("conversationId filter narrows", async () => {
    seedAudit("rivertown");
    const res = await GET(
      req("http://localhost/api/audit?conversationId=c1"),
    );
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  test("source filter narrows", async () => {
    seedAudit("rivertown");
    const res = await GET(req("http://localhost/api/audit?source=bloomerang"));
    const body = (await res.json()) as {
      total: number;
      entries: Array<{ source: string }>;
    };
    expect(body.total).toBe(2);
    for (const e of body.entries) expect(e.source).toBe("bloomerang");
  });

  test("toolName filter narrows", async () => {
    seedAudit("rivertown");
    const res = await GET(
      req("http://localhost/api/audit?toolName=bloomerang.getDonor"),
    );
    const body = (await res.json()) as {
      total: number;
      entries: Array<{ toolName: string }>;
    };
    expect(body.total).toBe(1);
    expect(body.entries[0].toolName).toBe("bloomerang.getDonor");
  });

  test("rejects unknown source with 400", async () => {
    const res = await GET(req("http://localhost/api/audit?source=novel"));
    expect(res.status).toBe(400);
  });

  test("limit caps the entries (count is the total match)", async () => {
    seedAudit("rivertown");
    const res = await GET(req("http://localhost/api/audit?limit=1"));
    const body = (await res.json()) as { total: number; entries: unknown[] };
    expect(body.total).toBe(3);
    expect(body.entries).toHaveLength(1);
  });

  test("tenantId param scopes to a different log", async () => {
    seedAudit("rivertown");
    seedAudit("alpha");
    const res = await GET(req("http://localhost/api/audit?tenantId=alpha"));
    const body = (await res.json()) as { total: number; tenantId: string };
    expect(body.tenantId).toBe("alpha");
    expect(body.total).toBe(3);
  });

  test("format=csv returns text/csv with the right header + rows", async () => {
    seedAudit("rivertown");
    const res = await GET(
      req("http://localhost/api/audit?format=csv&conversationId=c1"),
    );
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain(
      "kali-audit-rivertown.csv",
    );
    const text = await res.text();
    const lines = text.split("\n");
    expect(lines[0]).toContain("toolName");
    // header + 2 data rows for c1; recent() returns newest-first so
    // salesforce (later seed) appears before bloomerang.
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain("salesforce");
    expect(lines[2]).toContain("bloomerang");
  });
});
