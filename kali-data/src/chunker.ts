// Extracts retrievable text chunks from every connector dataset.
// Output: a single chunks.jsonl file per size, ready to feed to an embedding API.
//
// Each chunk has:
//   - id: stable across regenerations
//   - source: which connector
//   - kali_entity_id: link back to canonical graph
//   - type: chunk category (donor_profile, document_body, email_snippet, transcript, etc)
//   - text: the actual content to embed
//   - metadata: filters (date, dollarsBucket, programId, etc) for hybrid retrieval

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EntityGraph } from "./entities/types.ts";

export interface Chunk {
  id: string;
  source: "bloomerang" | "salesforce" | "sharepoint" | "m365" | "powerAutomate" | "powerBI" | "quickbooks" | "instrumentl" | "knowbe4" | "zoom" | "solana";
  kali_entity_id: string;
  type: string;
  text: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 64;
// Rough heuristic: ~4 chars/token on English text.
const APPROX_CHUNK_CHARS = CHUNK_SIZE_TOKENS * 4;
const APPROX_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * 4;

function chunkText(s: string): string[] {
  if (s.length <= APPROX_CHUNK_CHARS) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(s.length, i + APPROX_CHUNK_CHARS);
    out.push(s.slice(i, end));
    if (end >= s.length) break;
    i = end - APPROX_OVERLAP_CHARS;
  }
  return out;
}

export function extractChunks(g: EntityGraph): Chunk[] {
  const chunks: Chunk[] = [];

  // ── Donor profiles (Bloomerang + Salesforce merged narrative) ──
  for (const p of g.people.filter(pp => pp.isDonor || pp.isProspect)) {
    const employer = p.employer ? g.organizations.find(o => o.id === p.employer) : null;
    const giftCount = g.donations.filter(d => d.donorId === p.id).length;
    const text = [
      `${p.firstName} ${p.lastName} — ${p.donorSegment} donor.`,
      employer ? `Works at ${employer.name}${employer.hasMatchingGifts ? ` (matching gift program, cap $${employer.matchingGiftCap?.toLocaleString() ?? "n/a"})` : ""}.` : null,
      p.jobTitle ? `Title: ${p.jobTitle}.` : null,
      `Lifetime giving: $${(p.lifetimeGiving ?? 0).toLocaleString()}, ${giftCount} gifts.`,
      p.firstGiftDate ? `First gift: ${p.firstGiftDate}.` : null,
      p.lastGiftDate ? `Last gift: ${p.lastGiftDate}.` : null,
      `Address: ${p.address.city}, ${p.address.state}.`,
    ].filter(Boolean).join(" ");
    chunks.push({
      id: `chunk_donor_${p.id}`,
      source: "bloomerang",
      kali_entity_id: p.id,
      type: "donor_profile",
      text,
      metadata: { segment: p.donorSegment, lifetimeGiving: p.lifetimeGiving, hasEmployer: !!employer, employerHasMatching: employer?.hasMatchingGifts ?? false },
    });
  }

  // ── Donations (one chunk per gift, light text) ──
  for (const d of g.donations) {
    const donor = g.people.find(p => p.id === d.donorId);
    if (!donor) continue;
    const text = `Gift of $${d.amount.toLocaleString()} from ${donor.firstName} ${donor.lastName} on ${d.date}. Method: ${d.paymentMethod}.${d.isMatched ? ` Matched by employer for $${d.matchedAmount?.toLocaleString()}.` : ""}${d.acknowledged ? "" : " Not yet acknowledged."}`;
    chunks.push({
      id: `chunk_donation_${d.id}`,
      source: "bloomerang",
      kali_entity_id: d.id,
      type: "donation",
      text,
      metadata: { amount: d.amount, date: d.date, donorId: d.donorId, isMatched: d.isMatched ?? false, paymentMethod: d.paymentMethod, acknowledged: d.acknowledged ?? false },
    });
  }

  // ── SharePoint document bodies (chunked) ──
  for (const doc of g.documents) {
    const parts = chunkText(doc.body);
    parts.forEach((part, i) => {
      chunks.push({
        id: `chunk_doc_${doc.id}_${i}`,
        source: "sharepoint",
        kali_entity_id: doc.id,
        type: "document_body",
        text: `[${doc.type} — ${doc.title}]\n${part}`,
        metadata: { docType: doc.type, programId: doc.programId, grantId: doc.grantId, modifiedDate: doc.modifiedDate, partIndex: i, totalParts: parts.length, tags: doc.tags.join(",") },
      });
    });
  }

  // ── Email snippets ──
  for (const e of g.emails) {
    const from = g.people.find(p => p.id === e.fromId);
    const text = `Email from ${from?.firstName} ${from?.lastName} — Subject: ${e.subject}\nSnippet: ${e.snippet}`;
    chunks.push({
      id: `chunk_email_${e.id}`,
      source: "m365",
      kali_entity_id: e.id,
      type: "email_snippet",
      text,
      metadata: { date: e.date, threadId: e.threadId, fromId: e.fromId, hasAttachment: e.hasAttachment ?? false },
    });
  }

  // ── Zoom transcripts (chunked) ──
  for (const z of g.zoomMeetings) {
    if (!z.transcriptText) continue;
    const parts = chunkText(z.transcriptText);
    parts.forEach((part, i) => {
      chunks.push({
        id: `chunk_zoom_${z.id}_${i}`,
        source: "zoom",
        kali_entity_id: z.id,
        type: "transcript",
        text: `[Zoom: ${z.topic} — ${z.startTime}]\n${part}`,
        metadata: { topic: z.topic, startTime: z.startTime, durationMin: z.durationMin, hostId: z.hostId, partIndex: i, totalParts: parts.length, attendeeCount: z.attendeeIds.length },
      });
    });
  }

  // ── Grants (description + funder context) ──
  for (const gr of g.grants) {
    const funder = g.organizations.find(o => o.id === gr.funderId);
    const program = g.tenant.programs.find(p => p.id === gr.programId);
    const text = `Grant from ${funder?.name ?? "Unknown"} for ${program?.name ?? "general operating"}. Amount requested: $${gr.amount.toLocaleString()}.${gr.amountAwarded ? ` Awarded: $${Math.round(gr.amountAwarded).toLocaleString()}.` : ""} Status: ${gr.status}.${gr.deadline ? ` Deadline: ${gr.deadline}.` : ""}${gr.fitScore ? ` Fit score: ${gr.fitScore}/100.` : ""}${gr.notes ? `\nNotes: ${gr.notes}` : ""}`;
    chunks.push({
      id: `chunk_grant_${gr.id}`,
      source: "instrumentl",
      kali_entity_id: gr.id,
      type: "grant",
      text,
      metadata: { status: gr.status, amount: gr.amount, deadline: gr.deadline, funderId: gr.funderId, programId: gr.programId, fitScore: gr.fitScore },
    });
  }

  // ── Power Automate flow descriptions ──
  for (const f of g.powerAutomateFlows) {
    const text = `Workflow: ${f.name}. ${f.description}. Trigger: ${f.trigger}. Status: ${f.active ? "active" : "paused"}. Recent runs: ${f.runHistory.length} (${f.runHistory.filter(r => r.status === "success").length} succeeded, ${f.runHistory.filter(r => r.status === "failure").length} failed).`;
    chunks.push({
      id: `chunk_flow_${f.id}`,
      source: "powerAutomate",
      kali_entity_id: f.id,
      type: "workflow",
      text,
      metadata: { active: f.active, trigger: f.trigger, runCount: f.runHistory.length, successCount: f.runHistory.filter(r => r.status === "success").length },
    });
  }

  // ── KnowBe4 user posture summaries ──
  for (const k of g.knowBe4Results) {
    const u = g.people.find(p => p.id === k.userId);
    if (!u) continue;
    const text = `Security profile for ${u.firstName} ${u.lastName} (${u.staffRole}). Risk score: ${k.riskScore}/100. Training completion: ${k.trainingCompletionPct}%. Phishing tests: ${k.phishingTests.length} taken, ${k.phishingTests.filter(p => p.result !== "passed").length} failed.${k.flagged?.length ? ` Recently flagged: ${k.flagged.map(f => f.reason).join("; ")}.` : ""}`;
    chunks.push({
      id: `chunk_kb_${u.id}`,
      source: "knowbe4",
      kali_entity_id: u.id,
      type: "security_profile",
      text,
      metadata: { riskScore: k.riskScore, trainingPct: k.trainingCompletionPct, flaggedCount: k.flagged?.length ?? 0 },
    });
  }

  // ── Solana transactions ──
  for (const t of g.solanaTxs) {
    const recipient = g.people.find(p => p.id === t.recipientId) ?? g.organizations.find(o => o.id === t.recipientId);
    const recipientName = recipient && "firstName" in recipient ? `${recipient.firstName} ${recipient.lastName}` : recipient?.name ?? "Unknown";
    const text = `Onchain ${t.type.replace("_", " ")} of $${t.amountUsdc.toLocaleString()} USDC to ${recipientName} on ${t.date.slice(0, 10)}. Solana fee: $${(t.feeLamports * 0.00000003 * 165).toFixed(6)}. Tx: ${t.signature.slice(0, 12)}...`;
    chunks.push({
      id: `chunk_sol_${t.id}`,
      source: "solana",
      kali_entity_id: t.id,
      type: "onchain_tx",
      text,
      metadata: { amountUsdc: t.amountUsdc, type: t.type, date: t.date, signature: t.signature },
    });
  }

  return chunks;
}

// ── CLI entry: read graph, write chunks.jsonl ──
async function main() {
  const sizeArg = (process.argv[2] ?? "medium") as "small" | "medium" | "large";
  const root = new URL("../", import.meta.url).pathname;
  const inPath = join(root, "data", sizeArg, "_entity_graph.json");
  const outPath = join(root, "data", sizeArg, "chunks.jsonl");

  console.log(`[chunker] reading ${inPath}...`);
  const graph = JSON.parse(await readFile(inPath, "utf8")) as EntityGraph;
  console.log(`[chunker] extracting chunks...`);
  const chunks = extractChunks(graph);

  const lines = chunks.map(c => JSON.stringify(c)).join("\n");
  await writeFile(outPath, lines);

  const bySource = chunks.reduce<Record<string, number>>((acc, c) => { acc[c.source] = (acc[c.source] ?? 0) + 1; return acc; }, {});
  console.log(`\n[chunker] wrote ${chunks.length.toLocaleString()} chunks to ${outPath}`);
  console.log(`[chunker] est tokens: ~${Math.round(chunks.reduce((s, c) => s + c.text.length / 4, 0)).toLocaleString()}`);
  console.log(`[chunker] est embedding cost (voyage-3 @ $0.06/1M tokens): $${(chunks.reduce((s, c) => s + c.text.length / 4, 0) / 1_000_000 * 0.06).toFixed(4)}`);
  console.log(`[chunker] by source:`);
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(16)} ${count.toLocaleString()}`);
  }
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });
