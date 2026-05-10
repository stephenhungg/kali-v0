/**
 * Shared test/dev helpers for connector code. Production tool contexts come
 * from the API request layer; these stubs are for in-process use (unit tests,
 * the agent CLI, scripts that exercise tools without a real audit sink).
 */

import type { AuditEntry, ToolContext } from "./base";

export interface CapturingToolContext extends ToolContext {
  /** Audit entries collected so far. Mutated in place by each `audit()` call. */
  entries: AuditEntry[];
}

/**
 * A tool context that captures audit entries into an in-memory array. Use this
 * in tests to assert that each tool invocation writes the expected audit
 * record.
 */
export function makeCapturingContext(
  overrides: Partial<Omit<ToolContext, "audit">> = {},
): CapturingToolContext {
  const entries: AuditEntry[] = [];
  const ctx: CapturingToolContext = {
    tenantId: overrides.tenantId ?? "rivertown",
    userId: overrides.userId ?? "demo-user",
    conversationId: overrides.conversationId,
    entries,
    audit: async (entry: AuditEntry) => {
      entries.push(entry);
    },
  };
  return ctx;
}

/**
 * Stable param hash for audit entries. Uses Bun's built-in hasher when
 * available, otherwise falls back to a length-prefixed JSON form. Stability
 * across runs matters because audit records get diffed in tests.
 */
export function hashParams(input: unknown): string {
  const json = JSON.stringify(input ?? null);
  // Bun.hash returns a 64-bit integer as bigint
  const bunGlobal = (globalThis as { Bun?: { hash: (s: string) => bigint } }).Bun;
  if (bunGlobal && typeof bunGlobal.hash === "function") {
    return bunGlobal.hash(json).toString(16);
  }
  // Fallback: fast non-crypto fnv1a-32. Good enough for an audit fingerprint.
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
