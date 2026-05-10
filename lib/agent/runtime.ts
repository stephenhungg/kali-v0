// Kali agent runtime. Single Claude Sonnet 4.6 orchestrator with all 25+ tools
// available. Implements the full tool-use loop with parallel calls + audit logging.

import { loadConnectorData, toolsForClaude, findTool, type ToolContext } from "./tools.ts";

const MODEL = "claude-sonnet-4-5";
const API_VERSION = "2023-06-01";
const MAX_ITERATIONS = 20;

export const SYSTEM_PROMPT = `You are Kali, the agentic context layer for nonprofits.

Your job: answer questions and execute work for nonprofit staff by reasoning across their full SaaS stack — donor records (Bloomerang), CRM (Salesforce NPSP), documents (SharePoint), email + calendar (M365), workflows (Power Automate), analytics (Power BI), finance (QuickBooks), grants (Instrumentl), security training (KnowBe4), meetings (Zoom), and onchain payouts (Solana). You have ~25 tools spanning these systems.

The active tenant is **Rivertown Community Foundation**, a Sacramento-based community foundation with ~$2.4M annual budget across six programs (Youth Mentorship, Community Health Outreach, Workforce Development, Food Security Network, Family Stabilization, Operating).

REASONING APPROACH:
- Think in domains: donor / grants / finance / programs / comms / security / payouts.
- For complex queries, decompose: identify what tools each part needs, then issue parallel tool calls when possible.
- ALWAYS cite sources. Every claim should reference a record (kali_entity_id, doc title, transaction signature, etc).
- If context is missing or a tool returns nothing useful, say so. Never invent data.
- Prefer concrete numbers over hedges.
- If a question requires writing/mutating systems, use the appropriate tool — but for destructive actions, summarize what you'll do before doing it.

OUTPUT FORMAT:
- Lead with the answer in 1-3 sentences.
- Follow with structured details (lists, key metrics).
- Always include a "Sources" section listing the kali_entity_ids or record refs you used.
- Be concise. The chat is for staff who just want answers.`;

interface Block { type: "text" | "tool_use" | "tool_result"; [key: string]: unknown }
interface AnthropicMessage { role: "user" | "assistant"; content: string | Block[] }

async function callAnthropic(apiKey: string, messages: AnthropicMessage[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": API_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, tools: toolsForClaude(), messages }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  return res.json() as Promise<{ id: string; role: string; content: Block[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }>;
}

export interface RunResult {
  answer: string;
  iterations: number;
  toolCalls: { name: string; input: any; result: unknown; durationMs: number }[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
}

export async function run(query: string, ctx: ToolContext, apiKey: string): Promise<RunResult> {
  const t0 = Date.now();
  const messages: AnthropicMessage[] = [{ role: "user", content: query }];
  const toolCalls: RunResult["toolCalls"] = [];
  let totalInput = 0, totalOutput = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const resp = await callAnthropic(apiKey, messages);
    totalInput += resp.usage.input_tokens;
    totalOutput += resp.usage.output_tokens;
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "end_turn") {
      const text = resp.content.filter(b => b.type === "text").map(b => (b as any).text).join("\n");
      return { answer: text.trim(), iterations: iter + 1, toolCalls, totalInputTokens: totalInput, totalOutputTokens: totalOutput, totalDurationMs: Date.now() - t0 };
    }
    if (resp.stop_reason !== "tool_use") throw new Error(`unexpected stop_reason=${resp.stop_reason}`);

    const toolUseBlocks = resp.content.filter(b => b.type === "tool_use") as any[];
    const results = await Promise.all(toolUseBlocks.map(async (block) => {
      const tool = findTool(block.name);
      const tStart = Date.now();
      try {
        if (!tool) throw new Error(`unknown tool: ${block.name}`);
        const out = await tool.fn(block.input, ctx);
        toolCalls.push({ name: block.name, input: block.input, result: out, durationMs: Date.now() - tStart });
        return { tool_use_id: block.id, content: JSON.stringify(out).slice(0, 50000), is_error: false };
      } catch (e: any) {
        return { tool_use_id: block.id, content: `ERROR: ${e.message}`, is_error: true };
      }
    }));

    messages.push({
      role: "user",
      content: results.map(r => ({ type: "tool_result", tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error })),
    });
  }
  throw new Error(`exceeded ${MAX_ITERATIONS} iterations without final answer`);
}

// CLI entry
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }
  const args = process.argv.slice(2);
  const size = (args[0] ?? "medium") as "small" | "medium" | "large";
  const query = args.slice(1).join(" ");
  if (!query) { console.error('usage: bun lib/agent/runtime.ts <size> "<query>"'); process.exit(1); }

  console.log(`[kali-agent] loading connector data (size=${size})...`);
  const data = await loadConnectorData(size);
  const ctx = { size, data };
  console.log(`[kali-agent] tools available: ${toolsForClaude().length}`);
  console.log(`[kali-agent] query: "${query}"\n${"─".repeat(72)}`);

  const result = await run(query, ctx, apiKey);

  for (const tc of result.toolCalls) {
    console.log(`  → ${tc.name} (${tc.durationMs}ms) input=${JSON.stringify(tc.input).slice(0, 120)}`);
  }
  console.log("─".repeat(72) + "\n" + result.answer + "\n" + "─".repeat(72));
  console.log(`iterations=${result.iterations} | tools called=${result.toolCalls.length} | tokens in=${result.totalInputTokens} out=${result.totalOutputTokens} | ${result.totalDurationMs}ms`);
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });
