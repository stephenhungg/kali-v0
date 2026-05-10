/**
 * Kali agent runtime.
 *
 * Single Claude Sonnet 4.6 orchestrator with all ~70 tools available across
 * the 11 connectors. Implements the full tool-use loop with parallel calls,
 * prompt caching, and audit logging.
 *
 * The agent loads tools from the connector registry — every connector
 * self-registers when imported (see `import "./registrations"` below). Each
 * tool's zod input schema is converted to JSON Schema on the fly so Claude
 * gets a typed surface.
 *
 * CLI:
 *   bun lib/agent/runtime.ts "find lapsed major donors who attended a gala"
 */

import { z } from "zod";
import { listConnectors, listTools } from "../connectors/registry";
import type { ToolDefinition } from "../connectors/base";
import { getGlobalAuditLog, makeToolContext } from "../audit/log";
import "./registrations";

const MODEL = "claude-sonnet-4-6";
const API_VERSION = "2023-06-01";
const MAX_ITERATIONS = 20;
const MAX_TOKENS = 4096;

/* ─── system prompt ───────────────────────────────────────────────────── */

function describeToolInventory(): string {
  const byConnector = new Map<string, string[]>();
  for (const c of listConnectors()) {
    byConnector.set(
      `${c.label} (${c.domain})`,
      c.tools.map((t) => t.name),
    );
  }
  return Array.from(byConnector.entries())
    .map(([label, names]) => `- **${label}** — ${names.length} tools: ${names.join(", ")}`)
    .join("\n");
}

export const SYSTEM_PROMPT = `You are Kali, the agentic context layer for nonprofits.

Your job: answer questions and execute work for nonprofit staff by reasoning across their full SaaS stack — donor records (Bloomerang), CRM (Salesforce NPSP), documents (SharePoint), email + calendar (M365), workflows (Power Automate), analytics (Power BI), finance (QuickBooks), grants (Instrumentl), security training (KnowBe4), meetings (Zoom), and onchain payouts (Solana). You have ~70 tools spanning these systems.

The active tenant is **Rivertown Community Foundation**, a Sacramento-based community foundation with ~$2.4M annual budget across six programs (Youth Mentorship, Community Health Outreach, Workforce Development, Food Security Network, Family Stabilization, Operating).

REASONING APPROACH:
- Think in domains: donor / grants / finance / programs / comms / security / payouts / analytics.
- For complex queries, decompose: identify what tools each part needs, then issue PARALLEL tool calls in a single turn when the lookups are independent. The source-pulse panel lights up multiple tiles at once — that's the visual money shot.
- ALWAYS cite sources. Every claim should reference a record (kali_entity_id, doc title, transaction signature, etc).
- When multiple connectors describe the same person/org, they share a kali_entity_id — chain across tools by that id (e.g. bloomerang.getDonor → salesforce.getRelatedAccount → m365.getLastEmailToEmail).
- If context is missing or a tool returns nothing useful, say so. Never invent data.
- Prefer concrete numbers over hedges.
- For destructive or onchain actions (e.g. solana.batchPayout), summarize what you'll do BEFORE doing it.

OUTPUT FORMAT:
- Lead with the answer in 1–3 sentences.
- Follow with structured details (lists, key metrics).
- Always include a "Sources" section listing the kali_entity_ids or record refs you used.
- Be concise. The chat is for staff who just want answers.

TOOL INVENTORY (grouped by connector):
${describeToolInventory()}`;

/* ─── tool conversion (zod → Anthropic) ───────────────────────────────── */

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // zod 4 ships `z.toJSONSchema` natively. We strip the `$schema` field
  // because Anthropic's tool API wants a plain JSON Schema body.
  const json = (z as unknown as { toJSONSchema: (s: z.ZodTypeAny) => Record<string, unknown> })
    .toJSONSchema(schema);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = json as { $schema?: string };
  // Anthropic requires `type: "object"` at the top level for tool inputs.
  if (rest.type !== "object") {
    return { type: "object", properties: {}, ...rest };
  }
  return rest;
}

export function toAnthropicTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.input),
  }));
}

/* ─── HTTP client ─────────────────────────────────────────────────────── */

interface Block {
  type: "text" | "tool_use" | "tool_result";
  [key: string]: unknown;
}
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Block[];
}

interface AnthropicResponse {
  id: string;
  role: string;
  content: Block[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

async function callAnthropic(
  apiKey: string,
  messages: AnthropicMessage[],
  tools: AnthropicTool[],
): Promise<AnthropicResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // System prompt + tools list use a cache breakpoint at the end of the
      // tools array. On a typical conversation that takes ~10 tool calls,
      // every iteration after the first reads the cached prefix → ~90%
      // input-token savings.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: tools.map((t, i) =>
        i === tools.length - 1
          ? { ...t, cache_control: { type: "ephemeral" } }
          : t,
      ),
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as AnthropicResponse;
}

/* ─── run loop ────────────────────────────────────────────────────────── */

export interface ToolCallTrace {
  name: string;
  input: unknown;
  result: unknown;
  isError: boolean;
  durationMs: number;
}

export interface RunResult {
  answer: string;
  iterations: number;
  toolCalls: ToolCallTrace[];
  totalInputTokens: number;
  totalOutputTokens: number;
  cachedInputTokens: number;
  totalDurationMs: number;
  conversationId: string;
}

export interface RunOptions {
  apiKey: string;
  query: string;
  tenantId?: string;
  userId?: string;
  conversationId?: string;
}

export async function run(opts: RunOptions): Promise<RunResult> {
  const t0 = Date.now();
  const conversationId =
    opts.conversationId ?? `conv_${Date.now().toString(36)}`;
  const ctx = makeToolContext({
    tenantId: opts.tenantId ?? "rivertown",
    userId: opts.userId ?? "demo",
    conversationId,
  });
  const tools = listTools();
  const anthropicTools = toAnthropicTools(tools);
  const toolByName = new Map(tools.map((t) => [t.name, t] as const));

  const messages: AnthropicMessage[] = [{ role: "user", content: opts.query }];
  const trace: ToolCallTrace[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const resp = await callAnthropic(opts.apiKey, messages, anthropicTools);
    totalInput += resp.usage.input_tokens;
    totalOutput += resp.usage.output_tokens;
    totalCached += resp.usage.cache_read_input_tokens ?? 0;
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "end_turn") {
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n");
      return {
        answer: text.trim(),
        iterations: iter + 1,
        toolCalls: trace,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        cachedInputTokens: totalCached,
        totalDurationMs: Date.now() - t0,
        conversationId,
      };
    }
    if (resp.stop_reason !== "tool_use") {
      throw new Error(`unexpected stop_reason=${resp.stop_reason}`);
    }

    const toolUseBlocks = resp.content.filter(
      (b) => b.type === "tool_use",
    ) as Array<{ type: "tool_use"; id: string; name: string; input: unknown }>;

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const tStart = Date.now();
        const tool = toolByName.get(block.name);
        try {
          if (!tool) throw new Error(`unknown tool: ${block.name}`);
          const validatedInput = tool.input.parse(block.input);
          const out = await tool.handler(validatedInput, ctx);
          const dur = Date.now() - tStart;
          trace.push({
            name: block.name,
            input: block.input,
            result: out,
            isError: false,
            durationMs: dur,
          });
          return {
            tool_use_id: block.id,
            content: JSON.stringify(out).slice(0, 50_000),
            is_error: false,
          };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          trace.push({
            name: block.name,
            input: block.input,
            result: msg,
            isError: true,
            durationMs: Date.now() - tStart,
          });
          return {
            tool_use_id: block.id,
            content: `ERROR: ${msg}`,
            is_error: true,
          };
        }
      }),
    );

    messages.push({
      role: "user",
      content: toolResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: r.content,
        is_error: r.is_error,
      })),
    });
  }
  throw new Error(`exceeded ${MAX_ITERATIONS} iterations without final answer`);
}

/* ─── CLI entry ───────────────────────────────────────────────────────── */

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error('usage: bun lib/agent/runtime.ts "<query>"');
    process.exit(1);
  }

  const tools = listTools();
  console.log(`[kali-agent] connectors: ${listConnectors().length}, tools: ${tools.length}`);
  console.log(`[kali-agent] query: "${query}"\n${"─".repeat(72)}`);

  const result = await run({ apiKey, query });

  for (const tc of result.toolCalls) {
    const tag = tc.isError ? "✗" : "→";
    console.log(
      `  ${tag} ${tc.name} (${tc.durationMs}ms) input=${JSON.stringify(tc.input).slice(0, 120)}`,
    );
  }
  console.log("─".repeat(72));
  console.log(result.answer);
  console.log("─".repeat(72));
  console.log(
    `iterations=${result.iterations} | tools=${result.toolCalls.length} | tokens in=${result.totalInputTokens} (${result.cachedInputTokens} cached) out=${result.totalOutputTokens} | ${result.totalDurationMs}ms`,
  );
  console.log(`audit entries: ${getGlobalAuditLog().size()}`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
