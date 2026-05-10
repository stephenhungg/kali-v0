/**
 * Single source of truth for which connectors exist and how to look them up.
 * Each connector module registers itself here as it lands.
 */

import type { Connector, ConnectorId, ToolDefinition } from "./base";

const registry = new Map<ConnectorId, Connector>();

export function registerConnector(connector: Connector): void {
  if (registry.has(connector.id)) {
    throw new Error(`connector ${connector.id} already registered`);
  }
  registry.set(connector.id, connector);
}

export function getConnector(id: ConnectorId): Connector | undefined {
  return registry.get(id);
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values());
}

/** Flatten every tool across every registered connector. */
export function listTools(): ToolDefinition[] {
  return listConnectors().flatMap((c) => c.tools);
}

/** Look up one tool by its fully-qualified `<connector>.<fn>` name. */
export function getTool(name: string): ToolDefinition | undefined {
  return listTools().find((t) => t.name === name);
}
