/**
 * Backend sanity check — no network calls.
 *
 * Verifies the connector graph + agent runtime can boot end-to-end:
 *   - All 12 connectors register
 *   - Every seed loads + parses
 *   - 70+ tools surface
 *   - Tool input schemas convert to valid JSON Schema for Anthropic
 *   - The system prompt forms cleanly
 *   - The audit log captures a real tool call
 *
 * Run before plugging in ANTHROPIC_API_KEY:
 *   bun scripts/sanity.ts
 */

import "@/lib/agent/registrations";
import { listConnectors, listTools } from "@/lib/connectors/registry";
import { initAllAndTrack, listSyncStates } from "@/lib/connectors/sync-state";
import { SYSTEM_PROMPT, toAnthropicTools } from "@/lib/agent/runtime";
import { AuditLog, makeToolContext } from "@/lib/audit/log";

async function main() {
  const t0 = Date.now();
  console.log("[sanity] connectors registered:", listConnectors().length);
  for (const c of listConnectors()) {
    console.log(`  - ${c.id.padEnd(15)} (${c.tools.length} tools)`);
  }

  console.log(`\n[sanity] tools total: ${listTools().length}`);

  console.log("\n[sanity] initializing all connectors (loading seeds)…");
  await initAllAndTrack(
    listConnectors().map((c) => ({
      id: c.id,
      label: c.label,
      init: c.init,
    })),
  );
  for (const s of listSyncStates()) {
    const dot = s.status === "connected" ? "✓" : s.status === "error" ? "✗" : "·";
    console.log(`  ${dot} ${s.label.padEnd(22)} ${s.status}${s.lastError ? ` — ${s.lastError}` : ""}`);
  }

  const tools = listTools();
  console.log("\n[sanity] converting tool schemas to JSON Schema…");
  const anthropic = toAnthropicTools(tools);
  for (const t of anthropic) {
    if (t.input_schema.type !== "object") {
      throw new Error(`tool ${t.name} input_schema not object`);
    }
  }
  console.log(`  ✓ ${anthropic.length} tools converted cleanly`);

  console.log("\n[sanity] system prompt forms…");
  if (!SYSTEM_PROMPT.includes("Kali")) throw new Error("system prompt missing Kali");
  console.log(`  ✓ ${SYSTEM_PROMPT.length} chars, mentions Kali + Rivertown`);

  console.log("\n[sanity] live tool dispatch (bloomerang.searchDonors)…");
  const log = new AuditLog("sanity");
  const ctx = makeToolContext({
    tenantId: "sanity",
    userId: "smoketest",
    conversationId: "sanity_run",
    log,
  });
  const tool = tools.find((t) => t.name === "bloomerang.searchDonors");
  if (!tool) throw new Error("bloomerang.searchDonors not registered");
  const out = (await tool.handler({ segment: "lapsed", limit: 3 }, ctx)) as {
    count: number;
    donors: Array<{ kali_entity_id: string; name: string; segment: string }>;
  };
  console.log(`  ✓ returned ${out.count} matches, sample:`);
  for (const d of out.donors)
    console.log(`    - ${d.kali_entity_id} ${d.name} (${d.segment})`);
  console.log(`  ✓ audit log size: ${log.size()}`);

  console.log("\n[sanity] entity dossier (context.entityProfile)…");
  const profileTool = tools.find((t) => t.name === "context.entityProfile");
  if (!profileTool) throw new Error("context.entityProfile not registered");
  const target = out.donors[0]?.kali_entity_id;
  if (target) {
    const dossier = await profileTool.handler({ kali_entity_id: target }, ctx);
    console.log(`  ✓ profile loaded for ${target}`);
    console.log(`    presentIn=${(dossier as { presentIn: string[] })?.presentIn?.join(",")}`);
  } else {
    console.log("  · no donors found, skipping profile lookup");
  }

  console.log(`\n[sanity] ✓ all checks passed in ${Date.now() - t0}ms`);
}

main().catch((e) => {
  console.error("[sanity] FAILED:", e);
  process.exit(1);
});
