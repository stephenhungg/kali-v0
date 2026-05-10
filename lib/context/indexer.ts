/**
 * Bulk indexer — walks every connector seed and embeds the high-signal
 * text fields into the vector store. Run on cold start (or via an admin
 * tool/cron) so the agent's `context.semanticSearch` has something to
 * search against.
 *
 * Indexed corpora (highest signal first):
 *   - Zoom transcripts (chunked at ~500 tokens with 100-token overlap)
 *   - SharePoint document bodies (chunked at ~500 tokens with 100-token overlap)
 *   - M365 message subjects + bodyPreviews
 *   - Instrumentl grant notes
 *   - Bloomerang donor segment + engagement summary (low signal, but free)
 *   - Power BI tile titles
 *   - Power Automate flow descriptions
 */

import type { ConnectorId } from "../connectors/base";
import { getBloomerangSeed } from "../connectors/bloomerang";
import { getInstrumentlSeed } from "../connectors/instrumentl";
import { getM365Seed } from "../connectors/m365";
import { getPowerAutomateSeed } from "../connectors/powerautomate";
import { getPowerBISeed } from "../connectors/powerbi";
import { getSharepointSeed } from "../connectors/sharepoint";
import { getZoomSeed } from "../connectors/zoom";
import { getEmbedder } from "./embed";
import { size, upsertMany } from "./vectorStore";

interface ChunkInput {
  source: ConnectorId;
  sourceRecordId: string;
  kali_entity_id?: string;
  text: string;
  chunkIndex: number;
  meta?: Record<string, unknown>;
}

/** Naive whitespace chunker with overlap. */
export function chunkText(
  text: string,
  opts: { maxTokens?: number; overlapTokens?: number } = {},
): string[] {
  const maxTokens = opts.maxTokens ?? 500;
  const overlap = opts.overlapTokens ?? 100;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length <= maxTokens) return [tokens.join(" ")];

  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const slice = tokens.slice(i, i + maxTokens);
    out.push(slice.join(" "));
    if (i + maxTokens >= tokens.length) break;
    i += maxTokens - overlap;
  }
  return out;
}

/* ─── per-connector chunk extractors ─────────────────────────────────── */

async function chunksFromZoom(): Promise<ChunkInput[]> {
  const z = await getZoomSeed();
  const out: ChunkInput[] = [];
  for (const m of z.meetings) {
    if (!m.transcript || !m.transcript.text) continue;
    const chunks = chunkText(m.transcript.text);
    for (let i = 0; i < chunks.length; i++) {
      out.push({
        source: "zoom",
        sourceRecordId: m.kali_entity_id,
        text: chunks[i],
        chunkIndex: i,
        meta: { topic: m.topic, startTime: m.startTime, hostId: m.hostId },
      });
    }
  }
  return out;
}

async function chunksFromSharepoint(): Promise<ChunkInput[]> {
  const sp = await getSharepointSeed();
  const out: ChunkInput[] = [];
  for (const f of sp.files) {
    const combined = `${f.name}\n\n${f.body}`;
    const chunks = chunkText(combined);
    for (let i = 0; i < chunks.length; i++) {
      out.push({
        source: "sharepoint",
        sourceRecordId: f.kali_entity_id,
        kali_entity_id: f.kali_entity_id,
        text: chunks[i],
        chunkIndex: i,
        meta: {
          docType: f.type,
          siteId: f.siteId,
          tags: f.tags,
          relatedGrant: f.relatedGrant,
          relatedProgram: f.relatedProgram,
        },
      });
    }
  }
  return out;
}

async function chunksFromM365(): Promise<ChunkInput[]> {
  const m = await getM365Seed();
  return m.messages.map((msg) => ({
    source: "m365" as ConnectorId,
    sourceRecordId: msg.kali_entity_id,
    text: `${msg.subject}\n\n${msg.bodyPreview}`,
    chunkIndex: 0,
    meta: {
      conversationId: msg.conversationId,
      receivedDateTime: msg.receivedDateTime,
      from: msg.from.emailAddress.address,
    },
  }));
}

async function chunksFromInstrumentl(): Promise<ChunkInput[]> {
  const i = await getInstrumentlSeed();
  const out: ChunkInput[] = [];
  for (const g of i.grants) {
    const text = [
      g.title,
      `Funder: ${g.funderName}`,
      `Status: ${g.status}`,
      `Funding focus: ${g.fundingFocus.join(", ")}`,
      g.notes ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    out.push({
      source: "instrumentl",
      sourceRecordId: g.kali_entity_id,
      kali_entity_id: g.kali_entity_id,
      text,
      chunkIndex: 0,
      meta: {
        status: g.status,
        deadline: g.deadline,
        fitScore: g.fitScore,
      },
    });
  }
  return out;
}

async function chunksFromBloomerang(): Promise<ChunkInput[]> {
  const b = await getBloomerangSeed();
  return b.constituents.map((c) => ({
    source: "bloomerang" as ConnectorId,
    sourceRecordId: c.kali_entity_id,
    kali_entity_id: c.kali_entity_id,
    text: [
      `${c.firstName} ${c.lastName}`,
      `Segment: ${c.donorSegment}`,
      `Engagement: ${c.engagement.level}`,
      c.jobTitle ? `Title: ${c.jobTitle}` : "",
      c.address.city ? `City: ${c.address.city}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    chunkIndex: 0,
    meta: {
      segment: c.donorSegment,
      lifetimeGiving: c.lifetimeGiving,
      engagementLevel: c.engagement.level,
    },
  }));
}

async function chunksFromPowerBI(): Promise<ChunkInput[]> {
  const p = await getPowerBISeed();
  const out: ChunkInput[] = [];
  for (const d of p.dashboards) {
    for (const t of d.tiles) {
      out.push({
        source: "powerbi",
        sourceRecordId: t.tileId,
        text: `${d.displayName} — ${t.title}: ${t.currentValue} (trend ${(
          t.trendPct * 100
        ).toFixed(1)}%)`,
        chunkIndex: 0,
        meta: { dashboard: d.displayName, currentValue: t.currentValue },
      });
    }
  }
  return out;
}

async function chunksFromPowerAutomate(): Promise<ChunkInput[]> {
  const p = await getPowerAutomateSeed();
  return p.flows.map((f) => ({
    source: "powerautomate" as ConnectorId,
    sourceRecordId: f.kali_entity_id,
    text: [f.displayName, f.description, `Trigger: ${f.trigger}`].join("\n"),
    chunkIndex: 0,
    meta: { state: f.state, ownerId: f.ownerId },
  }));
}

/* ─── bulk index ─────────────────────────────────────────────────────── */

export interface IndexAllResult {
  namespace: string;
  embedder: string;
  embedderDim: number;
  chunksBySource: Record<string, number>;
  total: number;
  durationMs: number;
}

export async function indexAll(
  args: { namespace?: string; sources?: ConnectorId[] } = {},
): Promise<IndexAllResult> {
  const namespace = args.namespace ?? "rivertown";
  const t0 = Date.now();
  const embedder = getEmbedder();
  const allowed = (id: ConnectorId): boolean =>
    args.sources ? args.sources.includes(id) : true;

  const groups = await Promise.all([
    allowed("zoom") ? chunksFromZoom() : Promise.resolve([] as ChunkInput[]),
    allowed("sharepoint") ? chunksFromSharepoint() : Promise.resolve([] as ChunkInput[]),
    allowed("m365") ? chunksFromM365() : Promise.resolve([] as ChunkInput[]),
    allowed("instrumentl") ? chunksFromInstrumentl() : Promise.resolve([] as ChunkInput[]),
    allowed("bloomerang") ? chunksFromBloomerang() : Promise.resolve([] as ChunkInput[]),
    allowed("powerbi") ? chunksFromPowerBI() : Promise.resolve([] as ChunkInput[]),
    allowed("powerautomate") ? chunksFromPowerAutomate() : Promise.resolve([] as ChunkInput[]),
  ]);
  const flat = groups.flat();

  // Embed in batches to avoid huge single requests + to allow incremental
  // progress on slow networks.
  const BATCH = 64;
  const upsertBuffer: Array<Parameters<typeof upsertMany>[0][number]> = [];
  for (let i = 0; i < flat.length; i += BATCH) {
    const slice = flat.slice(i, i + BATCH);
    const vectors = await embedder.embedMany(slice.map((c) => c.text));
    for (let j = 0; j < slice.length; j++) {
      const c = slice[j];
      upsertBuffer.push({
        namespace,
        kali_entity_id: c.kali_entity_id,
        source: c.source,
        sourceRecordId: c.sourceRecordId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        meta: c.meta,
        vector: vectors[j],
      });
    }
  }
  upsertMany(upsertBuffer);

  const chunksBySource: Record<string, number> = {};
  for (const c of flat) {
    chunksBySource[c.source] = (chunksBySource[c.source] ?? 0) + 1;
  }
  return {
    namespace,
    embedder: embedder.model,
    embedderDim: embedder.dim,
    chunksBySource,
    total: size(namespace),
    durationMs: Date.now() - t0,
  };
}
