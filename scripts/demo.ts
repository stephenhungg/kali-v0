/**
 * Demo runner — fires the 5 wow queries against the real Anthropic API
 * and prints each event as it streams. Exercises the full backend stack:
 * connectors → tool registry → agent runtime → SSE stream.
 *
 * Setup:
 *   export ANTHROPIC_API_KEY=...
 *   # for the live solana payout (query 5): export KALI_SOLANA_DEVNET_SECRET_KEY=...
 *
 * Run:
 *   bun scripts/demo.ts            # all 5 queries
 *   bun scripts/demo.ts 1          # just query 1 (donor intelligence)
 *   bun scripts/demo.ts 1 3        # queries 1 + 3
 */

import "@/lib/agent/registrations";
import { runStream, type AgentEvent } from "@/lib/agent/stream";

interface WowQuery {
  id: number;
  name: string;
  prompt: string;
}

const QUERIES: WowQuery[] = [
  {
    id: 1,
    name: "Donor Intelligence",
    prompt:
      "Find lapsed donors who gave $1K+ at any point, attended at least 1 event, work at companies with active matching gift programs, and haven't received a re-engagement email in 90 days. Return up to 5 with their kali_entity_ids.",
  },
  {
    id: 2,
    name: "Grant Operations",
    prompt:
      "What grants closing in the next 60 days am I eligible for, and which board members or major donors have ties to those funders? Show top 3 by fit score.",
  },
  {
    id: 3,
    name: "Finance ↔ Programs Cross-Check",
    prompt:
      "Show our cash runway against projected program spend over the next 6 months. Flag anything from recent SharePoint reports that suggests programs are at risk of going over budget.",
  },
  {
    id: 4,
    name: "Automation Discovery",
    prompt:
      "Analyze the last 90 days of email patterns and Power Automate run history. Suggest one new workflow we could automate that would save staff at least 5 hours per week.",
  },
  {
    id: 5,
    name: "Onchain Money Moment",
    prompt:
      "We just got awarded $50K from a foundation. Disburse $25K to our partner org's wallet for a joint program, stipend the board for this quarter ($1K each), and refund any pending donor refunds. Show me the plan first, then execute on Solana devnet.",
  },
];

function pretty(value: unknown, max = 200): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function runOne(q: WowQuery, apiKey: string): Promise<void> {
  console.log("\n" + "═".repeat(72));
  console.log(`▶ Query ${q.id}: ${q.name}`);
  console.log("─".repeat(72));
  console.log(`> ${q.prompt}`);
  console.log("─".repeat(72));

  const t0 = Date.now();
  const events: AgentEvent[] = [];
  for await (const ev of runStream({
    apiKey,
    query: q.prompt,
  })) {
    events.push(ev);
    switch (ev.type) {
      case "start":
        process.stdout.write(`  ${ev.conversationId}\n`);
        break;
      case "tool_call":
        process.stdout.write(`  → ${ev.name} ${pretty(ev.input, 100)}\n`);
        break;
      case "tool_result":
        process.stdout.write(
          `  ${ev.isError ? "✗" : "✓"} ${ev.name} (${ev.durationMs}ms) → ${pretty(ev.result, 80)}\n`,
        );
        break;
      case "text":
        process.stdout.write("─".repeat(72) + "\n");
        process.stdout.write(ev.text + "\n");
        break;
      case "done":
        process.stdout.write("─".repeat(72) + "\n");
        process.stdout.write(
          `[${ev.iterations} iter, ${ev.totalInputTokens} in (${ev.cachedInputTokens} cached) ${ev.totalOutputTokens} out, ${ev.totalDurationMs}ms]\n`,
        );
        process.stdout.write(`citations: ${ev.citations.length}\n`);
        break;
      case "error":
        process.stdout.write(`✗ error: ${ev.message}\n`);
        break;
    }
  }
  console.log(
    `  Query ${q.id} done in ${Date.now() - t0}ms (${events.length} events).`,
  );
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set — see header of scripts/demo.ts");
    process.exit(1);
  }
  const wanted = process.argv.slice(2).map((s) => parseInt(s, 10));
  const queries =
    wanted.length === 0
      ? QUERIES
      : QUERIES.filter((q) => wanted.includes(q.id));
  if (queries.length === 0) {
    console.error(`no matching queries (use one of: ${QUERIES.map((q) => q.id).join(",")})`);
    process.exit(1);
  }

  for (const q of queries) {
    try {
      await runOne(q, apiKey);
    } catch (e) {
      console.error(`Query ${q.id} threw:`, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
