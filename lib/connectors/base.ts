/**
 * Connector framework — every SaaS integration plugs into this interface.
 *
 * A Connector exposes typed tools to the agent and reads from a seed dataset
 * (or a real OAuth-backed API in production). Every record carries enough
 * context to be entity-resolved and cited back to its source.
 */

import type { z } from "zod";

export type ConnectorId =
  | "bloomerang"
  | "salesforce"
  | "m365"
  | "zoom"
  | "sharepoint"
  | "instrumentl"
  | "quickbooks"
  | "solana"
  | "powerbi"
  | "powerautomate"
  | "knowbe4";

export type ToolDomain =
  | "donor"
  | "grants"
  | "finance"
  | "programs"
  | "comms"
  | "security"
  | "payouts"
  | "analytics";

/**
 * One callable function that the agent can invoke. Everything we expose to
 * Claude as a tool is described by one of these.
 */
export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** Stable name. Format: `<connector>.<function>` (e.g. `bloomerang.getDonor`). */
  name: string;
  /** One-line description shown to the model. */
  description: string;
  /** Domain bucket for system-prompt grouping and source-pulse routing. */
  domain: ToolDomain;
  /** Zod schema for input args. Compiled to JSON Schema for the model. */
  input: TInput;
  /** Zod schema for output. Validated before returning to the model. */
  output: TOutput;
  /**
   * The actual handler. Receives validated input, returns a value matching
   * the output schema. Throw to signal a recoverable error to the agent.
   */
  handler: (input: z.infer<TInput>, ctx: ToolContext) => Promise<z.infer<TOutput>>;
}

/**
 * Per-call context. Threaded through every tool invocation so handlers can
 * scope queries to the calling tenant and audit-log their work.
 */
export interface ToolContext {
  tenantId: string;
  userId: string;
  conversationId?: string;
  /** Append a record to the audit log. Implementations should be append-only. */
  audit: (entry: AuditEntry) => Promise<void>;
}

export interface AuditEntry {
  source: ConnectorId;
  toolName: string;
  paramsHash: string;
  recordIds: string[];
  durationMs: number;
}

/**
 * The connector itself — a bundle of tools backed by either a seed dataset
 * (v1 demo) or a real API client (post-v1).
 */
export interface Connector {
  id: ConnectorId;
  /** Human-readable label for the source-pulse panel. */
  label: string;
  /** Domain bucket — used for visual grouping in the UI. */
  domain: ToolDomain;
  /** All tools this connector exposes to the agent. */
  tools: ToolDefinition[];
  /** Optional setup hook — load seed data, validate schemas, etc. */
  init?: () => Promise<void>;
}

/**
 * Convenience: convert a Connector's tools into the shape Anthropic's tool
 * use API expects. The agent runtime calls this when assembling its prompt.
 */
export function describeForModel(connector: Connector) {
  return connector.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
}
