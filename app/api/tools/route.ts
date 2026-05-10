/**
 * GET /api/tools
 *
 * Introspection: returns every registered tool's name, description,
 * domain, source connector, and JSON-Schema-ified zod input/output. The
 * exact tool list Claude sees on each chat run.
 *
 * Useful for:
 *   - UI tooltip / "what can Kali actually do" panel
 *   - Dev sanity checks ("is bloomerang.searchDonors really registered?")
 *   - Building a tool catalog page
 *
 * Query params:
 *   ?source=bloomerang   filter to one connector
 *   ?domain=donor        filter by tool domain
 *   ?compact=1           strip the JSON Schemas (just name + description)
 */

import { NextResponse } from "next/server";
import { listConnectors, listTools } from "@/lib/connectors/registry";
import { toAnthropicTools } from "@/lib/agent/runtime";
import "@/lib/agent/registrations";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sourceFilter = url.searchParams.get("source");
  const domainFilter = url.searchParams.get("domain");
  const compact = url.searchParams.get("compact") === "1";

  const tools = listTools();
  const anthropicTools = toAnthropicTools(tools);
  const byName = new Map(anthropicTools.map((t) => [t.name, t]));

  const connectorByTool = new Map<string, { id: string; label: string }>();
  for (const c of listConnectors()) {
    for (const t of c.tools) {
      connectorByTool.set(t.name, { id: c.id, label: c.label });
    }
  }

  const rows = tools
    .filter((t) => {
      const conn = connectorByTool.get(t.name);
      if (sourceFilter && conn?.id !== sourceFilter) return false;
      if (domainFilter && t.domain !== domainFilter) return false;
      return true;
    })
    .map((t) => {
      const conn = connectorByTool.get(t.name);
      const schema = byName.get(t.name);
      return {
        name: t.name,
        description: t.description,
        domain: t.domain,
        source: conn?.id ?? null,
        sourceLabel: conn?.label ?? null,
        ...(compact ? {} : { input_schema: schema?.input_schema ?? null }),
      };
    });

  return NextResponse.json({
    total: rows.length,
    tools: rows,
  });
}
