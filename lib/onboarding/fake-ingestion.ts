/**
 * Fake ingestion stats — pure theater.
 *
 * Given a File the user dropped, return a deterministic-by-filename object
 * that *looks* like Kali extracted real entities. Same filename → same
 * stats (so the demo is repeatable). Numbers vary by file size + extension
 * so the spread feels real.
 *
 * No file content is ever read. We do NOT parse CSV / PDF / XLSX. The drop
 * is purely a UX prop — the underlying answers come from the canonical
 * Rivertown entity graph.
 */

export interface FakeIngestStats {
  recordsExtracted: number;
  entitiesResolved: number;
  /** What "kind" of records — drives the per-file label in the UI. */
  category: "donors" | "donations" | "documents" | "transactions" | "mixed";
  /** Synthesized progress duration, capped 1.4-2.8s. */
  durationMs: number;
}

const SIZE_BUCKETS: Array<{ max: number; range: [number, number] }> = [
  { max: 50_000, range: [50, 220] },
  { max: 250_000, range: [200, 650] },
  { max: 1_000_000, range: [600, 1900] },
  { max: 5_000_000, range: [1500, 4800] },
  { max: Infinity, range: [4500, 12_400] },
];

const EXT_CATEGORY: Record<string, FakeIngestStats["category"]> = {
  csv: "donors",
  xlsx: "donations",
  xls: "donations",
  pdf: "documents",
  doc: "documents",
  docx: "documents",
  json: "mixed",
  txt: "mixed",
  qbo: "transactions",
  qbb: "transactions",
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function fakeIngestStats(file: { name: string; size: number; type?: string }): FakeIngestStats {
  const seed = djb2(file.name);
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const category = EXT_CATEGORY[ext] ?? "mixed";

  const bucket = SIZE_BUCKETS.find(b => file.size <= b.max) ?? SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
  const span = bucket.range[1] - bucket.range[0];
  const records = bucket.range[0] + (seed % span);

  // Resolved entities = roughly 60-90% of extracted (some duplicates merge).
  const resolveRatio = 0.62 + ((seed >> 5) % 28) / 100;
  const entitiesResolved = Math.round(records * resolveRatio);

  // Duration scales with size, capped 1.4-2.8s.
  const sizePct = Math.min(file.size / 5_000_000, 1);
  const durationMs = Math.round(1400 + sizePct * 1400);

  return { recordsExtracted: records, entitiesResolved, category, durationMs };
}
