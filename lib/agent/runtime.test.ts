/**
 * Tests for the agent runtime — focused on the parts we can exercise
 * without hitting the live Anthropic API:
 *   - All 11 connectors register on import
 *   - Every tool's zod input schema converts to a valid JSON Schema
 *   - The system prompt mentions the connector inventory
 *   - The audit-context helper feeds entries into a real AuditLog
 *
 * The actual Claude tool-use loop is exercised end-to-end via the CLI
 * (`bun lib/agent/runtime.ts "<query>"`) when ANTHROPIC_API_KEY is set.
 */

import { describe, expect, test } from "bun:test";
import "./registrations";
import { listConnectors, listTools } from "../connectors/registry";
import { SYSTEM_PROMPT, toAnthropicTools } from "./runtime";
import { AuditLog, makeToolContext } from "../audit/log";

describe("connector registration", () => {
  test("all 11 SaaS connectors + context meta-connector registered", () => {
    const ids = listConnectors().map((c) => c.id).sort();
    expect(ids).toEqual(
      [
        "bloomerang",
        "context",
        "instrumentl",
        "knowbe4",
        "m365",
        "powerautomate",
        "powerbi",
        "quickbooks",
        "salesforce",
        "sharepoint",
        "solana",
        "zoom",
      ].sort(),
    );
  });

  test("listTools() returns ~70 tools across all connectors", () => {
    const tools = listTools();
    expect(tools.length).toBeGreaterThanOrEqual(60);
    expect(tools.length).toBeLessThanOrEqual(100);
  });

  test("every tool name follows <connector>.<fn> format", () => {
    for (const t of listTools()) {
      expect(t.name).toMatch(/^[a-z0-9_]+\.[a-zA-Z0-9_]+$/);
    }
  });
});

describe("toAnthropicTools / zod → JSON schema", () => {
  test("every tool produces an object-type JSON Schema", () => {
    const tools = toAnthropicTools(listTools());
    for (const t of tools) {
      expect(t.name).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.input_schema).toBeDefined();
      expect(t.input_schema.type).toBe("object");
    }
  });

  test("input schemas don't carry the JSON Schema $schema field", () => {
    const tools = toAnthropicTools(listTools());
    for (const t of tools) {
      expect((t.input_schema as { $schema?: string }).$schema).toBeUndefined();
    }
  });

  // Regression: Anthropic's tool-name regex is ^[a-zA-Z0-9_-]{1,128}$ —
  // dots are rejected with HTTP 400. Our internal naming is dotted
  // (`bloomerang.searchDonors`) and we transform on the API boundary.
  test("emitted tool names match Anthropic's allowed pattern (no dots)", () => {
    const tools = toAnthropicTools(listTools());
    const allowed = /^[a-zA-Z0-9_-]{1,128}$/;
    for (const t of tools) {
      expect(t.name).toMatch(allowed);
      expect(t.name).not.toContain(".");
    }
  });

  test("toAnthropicName / fromAnthropicName round-trip every registered tool", async () => {
    const { toAnthropicName, fromAnthropicName } = await import("./runtime");
    for (const t of listTools()) {
      expect(fromAnthropicName(toAnthropicName(t.name))).toBe(t.name);
    }
  });
});

describe("SYSTEM_PROMPT", () => {
  test("mentions Kali identity + tenant", () => {
    expect(SYSTEM_PROMPT).toContain("Kali");
    expect(SYSTEM_PROMPT).toContain("Rivertown Community Foundation");
  });

  test("includes all 11 connector labels in the inventory", () => {
    expect(SYSTEM_PROMPT).toContain("Bloomerang");
    expect(SYSTEM_PROMPT).toContain("Salesforce");
    expect(SYSTEM_PROMPT).toContain("Microsoft 365");
    expect(SYSTEM_PROMPT).toContain("SharePoint");
    expect(SYSTEM_PROMPT).toContain("Instrumentl");
    expect(SYSTEM_PROMPT).toContain("QuickBooks");
    expect(SYSTEM_PROMPT).toContain("Solana");
    expect(SYSTEM_PROMPT).toContain("Zoom");
    expect(SYSTEM_PROMPT).toContain("Power BI");
    expect(SYSTEM_PROMPT).toContain("Power Automate");
    expect(SYSTEM_PROMPT).toContain("KnowBe4");
  });

  test("emphasises citations + parallel tool use", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("cite");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("parallel");
  });
});

describe("audit context end-to-end", () => {
  test("a tool call through makeToolContext lands in the AuditLog", async () => {
    const log = new AuditLog("smoketest");
    const ctx = makeToolContext({
      tenantId: "smoketest",
      userId: "u1",
      conversationId: "c1",
      log,
    });
    // Pick the bloomerang.searchDonors tool — registered, real handler.
    const tool = listTools().find((t) => t.name === "bloomerang.searchDonors")!;
    const out = await tool.handler({ segment: "lapsed", limit: 3 }, ctx);
    expect(out).toBeDefined();
    expect(log.size()).toBe(1);
    const rec = log.recent()[0];
    expect(rec.toolName).toBe("bloomerang.searchDonors");
    expect(rec.source).toBe("bloomerang");
    expect(rec.conversationId).toBe("c1");
  });
});
