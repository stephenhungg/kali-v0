import { afterEach, describe, expect, test } from "bun:test";
import {
  AuditLog,
  getAuditLog,
  getGlobalAuditLog,
  makeToolContext,
  __resetAuditLogs,
} from "./log";
import type { AuditEntry } from "../connectors/base";

afterEach(() => __resetAuditLogs());

const sampleEntry: AuditEntry = {
  source: "bloomerang",
  toolName: "bloomerang.searchDonors",
  paramsHash: "abc123",
  recordIds: ["ppl_1", "ppl_2"],
  durationMs: 4,
};

describe("AuditLog", () => {
  test("record() returns a stable record with id + timestamp", () => {
    const log = new AuditLog("tenant_a");
    const r = log.record({
      entry: sampleEntry,
      userId: "u1",
      conversationId: "c1",
    });
    expect(r.id).toMatch(/^aud_/);
    expect(r.tenantId).toBe("tenant_a");
    expect(r.userId).toBe("u1");
    expect(r.conversationId).toBe("c1");
    expect(r.source).toBe("bloomerang");
    expect(r.recordIds).toEqual(["ppl_1", "ppl_2"]);
    expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("size() reflects appends and queries don't mutate", () => {
    const log = new AuditLog("tenant_a");
    expect(log.size()).toBe(0);
    log.record({ entry: sampleEntry, userId: "u1" });
    log.record({ entry: sampleEntry, userId: "u1" });
    expect(log.size()).toBe(2);
    expect(log.recent().length).toBe(2);
    expect(log.byTool(sampleEntry.toolName).length).toBe(2);
    expect(log.size()).toBe(2);
  });

  test("recent() returns newest first", () => {
    const log = new AuditLog("tenant_a");
    log.record({ entry: { ...sampleEntry, paramsHash: "first" }, userId: "u1" });
    log.record({ entry: { ...sampleEntry, paramsHash: "second" }, userId: "u1" });
    const r = log.recent();
    expect(r[0].paramsHash).toBe("second");
    expect(r[1].paramsHash).toBe("first");
  });

  test("byTool / bySource filter correctly", () => {
    const log = new AuditLog("tenant_a");
    log.record({ entry: { ...sampleEntry, toolName: "bloomerang.getDonor" }, userId: "u1" });
    log.record({ entry: { ...sampleEntry, source: "salesforce", toolName: "salesforce.getContact" }, userId: "u1" });
    expect(log.byTool("bloomerang.getDonor").length).toBe(1);
    expect(log.bySource("salesforce").length).toBe(1);
  });

  test("forConversation returns only that conversation's entries in chrono order", () => {
    const log = new AuditLog("tenant_a");
    log.record({ entry: sampleEntry, userId: "u1", conversationId: "conv_a" });
    log.record({ entry: sampleEntry, userId: "u1", conversationId: "conv_b" });
    log.record({ entry: sampleEntry, userId: "u1", conversationId: "conv_a" });
    const a = log.forConversation("conv_a");
    expect(a.length).toBe(2);
    expect(a[0].recordedAt <= a[1].recordedAt).toBe(true);
  });

  test("toCsv() produces a header + one row per entry", () => {
    const log = new AuditLog("tenant_a");
    log.record({ entry: sampleEntry, userId: "u1", conversationId: "c1" });
    const csv = log.toCsv();
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("toolName");
    expect(lines[1]).toContain("bloomerang.searchDonors");
  });
});

describe("getAuditLog / per-tenant isolation", () => {
  test("returns the same instance for repeated calls with the same tenantId", () => {
    const a1 = getAuditLog("tenant_a");
    const a2 = getAuditLog("tenant_a");
    expect(a1).toBe(a2);
  });

  test("different tenants get separate logs", () => {
    const a = getAuditLog("tenant_a");
    const b = getAuditLog("tenant_b");
    expect(a).not.toBe(b);
    a.record({ entry: sampleEntry, userId: "u1" });
    expect(a.size()).toBe(1);
    expect(b.size()).toBe(0);
  });

  test("getGlobalAuditLog is a separate __global__ tenant", () => {
    const g = getGlobalAuditLog();
    g.record({ entry: sampleEntry, userId: "u1" });
    expect(g.tenantId).toBe("__global__");
  });
});

describe("makeToolContext", () => {
  test("audits into the tenant's log", async () => {
    const ctx = makeToolContext({
      tenantId: "tenant_a",
      userId: "u1",
      conversationId: "c1",
    });
    await ctx.audit(sampleEntry);
    const log = getAuditLog("tenant_a");
    expect(log.size()).toBe(1);
    expect(log.recent()[0].source).toBe("bloomerang");
  });

  test("respects a caller-provided log", async () => {
    const log = new AuditLog("scratch");
    const ctx = makeToolContext({
      tenantId: "scratch",
      userId: "u1",
      log,
    });
    await ctx.audit(sampleEntry);
    expect(log.size()).toBe(1);
  });

  test("is independent across tenant ids", async () => {
    const c1 = makeToolContext({ tenantId: "alpha", userId: "u" });
    const c2 = makeToolContext({ tenantId: "beta", userId: "u" });
    await c1.audit(sampleEntry);
    expect(getAuditLog("alpha").size()).toBe(1);
    expect(getAuditLog("beta").size()).toBe(0);
    await c2.audit(sampleEntry);
    expect(getAuditLog("beta").size()).toBe(1);
  });
});
