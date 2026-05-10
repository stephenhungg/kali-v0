/**
 * Tool name → connector id. Used by the source-pulse panel: when the agent
 * fires a `bloomerang.*` tool, the Bloomerang tile glows.
 *
 * Tool names follow the convention `<connector>.<fn>` (per
 * lib/connectors/base.ts), so we just split on the first dot.
 */

import type { ConnectorId as RealConnectorId } from "../connectors/base";

export type ConnectorId = RealConnectorId | "_meta";

/** Resolve a tool name (e.g. `bloomerang.searchDonors`) to its connector id. */
export function connectorForTool(toolName: string): ConnectorId {
  const dot = toolName.indexOf(".");
  if (dot === -1) return "_meta";
  return toolName.slice(0, dot) as ConnectorId;
}
