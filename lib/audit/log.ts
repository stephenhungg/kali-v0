/**
 * Append-only audit log + ToolContext factory.
 *
 * Every connector tool call writes one entry via `ctx.audit(...)`. In v1
 * we keep the log in-process (per-tenant Map) for the demo; production
 * persists to the `audit_log` Drizzle table (see `lib/db/schema.ts`).
 *
 * Two operating modes:
 *   - Single global log via `getGlobalAuditLog()` for simple CLI / agent
 *     runs.
 *   - Per-tenant via `getAuditLog(tenantId)` for multi-tenant API contexts.
 *
 * The log is **append-only at the API surface** — `record()` is the only
 * write. Reads (`recent`, `byTool`, `forConversation`) are pure queries.
 */

import type { AuditEntry, ConnectorId, ToolContext } from "../connectors/base";

export interface AuditRecord extends AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  recordedAt: string;
}

let __seq = 0;
function nextId(): string {
  __seq++;
  return `aud_${Date.now().toString(36)}_${__seq.toString(36)}`;
}

export class AuditLog {
  /** Tenant id this log is scoped to. */
  readonly tenantId: string;
  private readonly entries: AuditRecord[] = [];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /** Single point of mutation. Appends a new audit entry. */
  record(meta: {
    entry: AuditEntry;
    userId: string;
    conversationId?: string;
  }): AuditRecord {
    const rec: AuditRecord = {
      id: nextId(),
      tenantId: this.tenantId,
      userId: meta.userId,
      conversationId: meta.conversationId,
      recordedAt: new Date().toISOString(),
      source: meta.entry.source,
      toolName: meta.entry.toolName,
      paramsHash: meta.entry.paramsHash,
      recordIds: meta.entry.recordIds,
      durationMs: meta.entry.durationMs,
    };
    this.entries.push(rec);
    return rec;
  }

  /** Total count of entries (sanity-checks the append-only invariant in tests). */
  size(): number {
    return this.entries.length;
  }

  /** Latest N entries (newest last). */
  all(): readonly AuditRecord[] {
    return this.entries;
  }

  /** Last N entries (newest first). */
  recent(limit = 50): AuditRecord[] {
    return [...this.entries].reverse().slice(0, limit);
  }

  /** Entries filtered to a specific tool name. */
  byTool(toolName: string): AuditRecord[] {
    return this.entries.filter((e) => e.toolName === toolName);
  }

  /** Entries filtered to a specific connector. */
  bySource(source: ConnectorId): AuditRecord[] {
    return this.entries.filter((e) => e.source === source);
  }

  /** Entries scoped to one conversation, in chronological order. */
  forConversation(conversationId: string): AuditRecord[] {
    return this.entries.filter((e) => e.conversationId === conversationId);
  }

  /** CSV serializer for export — matches the v1 spec §2.4 deliverable. */
  toCsv(): string {
    const header =
      "id,tenantId,userId,conversationId,recordedAt,source,toolName,paramsHash,recordIds,durationMs";
    const rows = this.entries.map((e) =>
      [
        e.id,
        e.tenantId,
        e.userId,
        e.conversationId ?? "",
        e.recordedAt,
        e.source,
        e.toolName,
        e.paramsHash,
        `"${e.recordIds.join("|")}"`,
        e.durationMs,
      ].join(","),
    );
    return [header, ...rows].join("\n");
  }
}

const __byTenant = new Map<string, AuditLog>();

export function getAuditLog(tenantId: string): AuditLog {
  let log = __byTenant.get(tenantId);
  if (!log) {
    log = new AuditLog(tenantId);
    __byTenant.set(tenantId, log);
  }
  return log;
}

export function getGlobalAuditLog(): AuditLog {
  return getAuditLog("__global__");
}

/** Test/dev-only: drop every per-tenant log. */
export function __resetAuditLogs(): void {
  __byTenant.clear();
}

/**
 * Build a ToolContext that writes audit entries into the given log.
 * Use this in the agent runtime, scripts, and tests that need a real audit
 * trail (the existing `makeCapturingContext` in `connectors/test-helpers`
 * is the unit-test shorthand).
 */
export function makeToolContext(opts: {
  tenantId: string;
  userId: string;
  conversationId?: string;
  log?: AuditLog;
}): ToolContext {
  const log = opts.log ?? getAuditLog(opts.tenantId);
  return {
    tenantId: opts.tenantId,
    userId: opts.userId,
    conversationId: opts.conversationId,
    audit: async (entry) => {
      log.record({
        entry,
        userId: opts.userId,
        conversationId: opts.conversationId,
      });
    },
  };
}
