// Generates the full canonical seed: 11 connector JSONs + the source-of-truth
// entity graph + a stats file. Outputs to data/seed/<size>/.
//
// Usage:
//   bun scripts/generate-seed.ts            (defaults to medium)
//   bun scripts/generate-seed.ts small
//   bun scripts/generate-seed.ts medium
//   bun scripts/generate-seed.ts large

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildGraph, type Size } from "../lib/seed/build-graph.ts";
import { projectAll } from "../lib/seed/project.ts";

async function main() {
  const sizeArg = (process.argv[2] ?? "medium") as Size;
  if (!["small", "medium", "large"].includes(sizeArg)) {
    console.error(`unknown size: ${sizeArg}. use small | medium | large`);
    process.exit(1);
  }

  console.log(`\n[seed] building entity graph for size=${sizeArg}...`);
  const t0 = Date.now();
  const graph = buildGraph(sizeArg);
  console.log(`[seed] graph built in ${Date.now() - t0}ms`);

  console.log(`[seed] projecting 11 connector views...`);
  const projections = projectAll(graph);

  const outDir = path.join(process.cwd(), "data", "seed", sizeArg);
  await mkdir(outDir, { recursive: true });

  for (const [name, payload] of Object.entries(projections)) {
    await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(payload, null, 2));
  }
  await writeFile(path.join(outDir, "_entity_graph.json"), JSON.stringify(graph, null, 2));

  const stats = {
    size: sizeArg,
    elapsedMs: Date.now() - t0,
    counts: {
      people: graph.people.length,
      staff: graph.people.filter(p => p.isStaff).length,
      board: graph.people.filter(p => p.isBoard).length,
      donors: graph.people.filter(p => p.isDonor).length,
      prospects: graph.people.filter(p => p.isProspect).length,
      lapsedDonors: graph.people.filter(p => p.donorSegment === "lapsed").length,
      organizations: graph.organizations.length,
      donations: graph.donations.length,
      donationsTotalUsd: Math.round(graph.donations.reduce((s, d) => s + d.amount, 0)),
      campaigns: graph.campaigns.length,
      events: graph.events.length,
      grants: graph.grants.length,
      grantsAwarded: graph.grants.filter(g => ["awarded", "active", "reporting", "closed"].includes(g.status)).length,
      documents: graph.documents.length,
      emails: graph.emails.length,
      calendarEvents: graph.calendarEvents.length,
      zoomMeetings: graph.zoomMeetings.length,
      zoomTranscripts: graph.zoomMeetings.filter(z => z.hasTranscript).length,
      powerAutomateFlows: graph.powerAutomateFlows.length,
      powerBIDashboards: graph.powerBIDashboards.length,
      qbTransactions: graph.qbTransactions.length,
      knowBe4Records: graph.knowBe4Results.length,
      solanaTxs: graph.solanaTxs.length,
      solanaTotalUsdcDisbursed: Math.round(graph.solanaTxs.reduce((s, t) => s + t.amountUsdc, 0)),
    },
  };
  await writeFile(path.join(outDir, "_stats.json"), JSON.stringify(stats, null, 2));

  console.log(`\n[seed] wrote ${Object.keys(projections).length} connector files + entity graph + stats to ${outDir}\n`);
  console.log(`stats:`);
  for (const [k, v] of Object.entries(stats.counts)) {
    console.log(`  ${k.padEnd(28)} ${typeof v === "number" ? v.toLocaleString() : v}`);
  }
  console.log(`\n[seed] done in ${Date.now() - t0}ms.`);
}

main().catch(e => { console.error(e); process.exit(1); });
