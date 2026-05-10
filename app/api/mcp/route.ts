/**
 * GET /api/mcp
 *
 * Lightweight MCP-style discovery endpoint. Returns the manifest of
 * tools any agent (Claude, ChatGPT, custom) can call against Kali. Each
 * x402_* and causecoin_* tool surfaces here automatically because the
 * connector registry is the source of truth.
 *
 * NOT a full JSON-RPC MCP server (that needs WebSocket/stdio transport)
 * but the same JSON shape Claude's discovery layer expects from
 * .well-known/mcp.json. Suitable for a tool catalog page or for chained
 * agents that just need to know "what does Kali offer."
 */

import { NextResponse } from "next/server";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 60;

function zodSchemaToJson(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = (z as unknown as { toJSONSchema: (s: z.ZodTypeAny) => Record<string, unknown> }).toJSONSchema(schema);
  const { $schema: _drop, ...rest } = json as Record<string, unknown> & { $schema?: string };
  void _drop;
  return rest;
}

export async function GET() {
  const connectors = listConnectors();
  const tools = connectors.flatMap((c) =>
    c.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodSchemaToJson(t.input),
      domain: t.domain,
      connector: c.id,
    })),
  );
  return NextResponse.json({
    version: 1,
    schema: "mcp-tool-catalog/0.1",
    operator: {
      name: "Kali Labs",
      url: "https://kalilabs.ai",
      docs: "https://kalilabs.ai/docs/agents",
    },
    connectors: connectors.map((c) => ({
      id: c.id,
      label: c.label,
      domain: c.domain,
      toolCount: c.tools.length,
    })),
    tools,
  });
}
