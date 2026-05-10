/**
 * GET /api/audit
 *
 * Per-tenant audit log of every tool call the agent made. Powers the audit
 * log viewer in the chat UI and the v1 success criterion #5
 * ("audit log shows every tool call from the demo, exportable as CSV").
 *
 * Query params:
 *   tenantId      defaults to "rivertown"
 *   conversationId   filter to one conversation
 *   source           filter to one connector (e.g. bloomerang)
 *   toolName         filter to one tool name
 *   limit            default 100, max 1000
 *   format=csv       return text/csv instead of JSON
 *
 * Returns JSON:
 *   { tenantId, total, entries: AuditRecord[] }
 *
 * Or CSV when `format=csv`. The CSV is the same one AuditLog.toCsv() emits,
 * filtered to the matching subset.
 */

import { NextResponse } from "next/server";
import type { ConnectorId } from "@/lib/connectors/base";
import { AuditLog, getAuditLog } from "@/lib/audit/log";
import "@/lib/agent/registrations";

export const runtime = "nodejs";

const KNOWN_SOURCES: ConnectorId[] = [
  "bloomerang",
  "salesforce",
  "m365",
  "zoom",
  "sharepoint",
  "instrumentl",
  "quickbooks",
  "solana",
  "powerbi",
  "powerautomate",
  "knowbe4",
  "context",
];

function isConnectorId(s: string | null): s is ConnectorId {
  return !!s && (KNOWN_SOURCES as string[]).includes(s);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "rivertown";
  const conversationId = url.searchParams.get("conversationId");
  const sourceParam = url.searchParams.get("source");
  const toolName = url.searchParams.get("toolName");
  const limitParam = url.searchParams.get("limit");
  const format = url.searchParams.get("format");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1_000) : 100;

  const log = getAuditLog(tenantId);
  let entries = log.recent(10_000); // pull a generous slice, then filter

  if (conversationId) entries = entries.filter((e) => e.conversationId === conversationId);
  if (sourceParam) {
    if (!isConnectorId(sourceParam)) {
      return NextResponse.json(
        { error: `unknown source: ${sourceParam}` },
        { status: 400 },
      );
    }
    entries = entries.filter((e) => e.source === sourceParam);
  }
  if (toolName) entries = entries.filter((e) => e.toolName === toolName);

  const total = entries.length;
  entries = entries.slice(0, limit);

  if (format === "csv") {
    // Build a small AuditLog with just the matching entries to reuse toCsv().
    const tmp = new AuditLog(tenantId);
    for (const e of entries) {
      tmp.record({
        entry: {
          source: e.source,
          toolName: e.toolName,
          paramsHash: e.paramsHash,
          recordIds: e.recordIds,
          durationMs: e.durationMs,
        },
        userId: e.userId,
        conversationId: e.conversationId,
      });
    }
    return new Response(tmp.toCsv(), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kali-audit-${tenantId}.csv"`,
      },
    });
  }

  return NextResponse.json({
    tenantId,
    total,
    limit,
    entries,
  });
}
