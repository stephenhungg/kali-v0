/**
 * Generate seeded x402 receipts for the demo. Writes
 * `data/seed/<size>/x402.json` with ~30 receipts spanning the past 90 days,
 * mixing human / autonomous / unknown attributions in a believable distribution.
 *
 * Usage: bun scripts/generate-x402-seed.ts medium
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import seedrandom from "seedrandom";
import type { MemX402Receipt } from "@/lib/db/memory";

const SIZE = (process.argv[2] ?? "medium") as "small" | "medium" | "large";
const TENANT_ID = "tenant_rivertown";

const COUNTS = {
  small: 12,
  medium: 32,
  large: 80,
} as const;

const HUMAN_MEMOS = [
  "Climate giving subscription",
  "Gala fund — anonymous patron",
  "Q3 family stabilization",
  "Memorial gift for J. Carter",
  "End-of-year matching gift",
  "Sustainer monthly",
  "Emergency relief",
];
const AUTONOMOUS_MEMOS = [
  "research-bot · climate data licensing",
  "agent · data pipeline subscription",
  "claude.com agent — programmatic donation",
  "autonomous agent · API consumption",
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function fakeWallet(rng: () => number): string {
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += alpha[Math.floor(rng() * alpha.length)];
  return s;
}

function fakeSig(rng: () => number): string {
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) s += alpha[Math.floor(rng() * alpha.length)];
  return s;
}

async function main() {
  const rng = seedrandom("kali-x402-seed");
  const count = COUNTS[SIZE];
  const receipts: MemX402Receipt[] = [];

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rng() * 90);
    const minutesAgo = Math.floor(rng() * 60 * 24);
    const receivedAt = new Date(
      Date.now() - daysAgo * 86_400_000 - minutesAgo * 60_000,
    ).toISOString();

    // 60% human, 25% autonomous, 15% unknown
    const r = rng();
    const attribution: MemX402Receipt["attribution"] =
      r < 0.6 ? "human" : r < 0.85 ? "autonomous" : "unknown";

    let amount: number;
    if (attribution === "human") {
      amount = Math.round((10 + rng() * 90) * 100) / 100;
    } else if (attribution === "autonomous") {
      amount = Math.round((0.5 + rng() * 8) * 100) / 100;
    } else {
      amount = Math.round((1 + rng() * 25) * 100) / 100;
    }

    const memo =
      attribution === "human"
        ? pick(HUMAN_MEMOS, rng)
        : attribution === "autonomous"
          ? pick(AUTONOMOUS_MEMOS, rng)
          : null;

    const id = `rcpt_seed_${i.toString(36).padStart(4, "0")}`;
    receipts.push({
      id,
      tenantId: TENANT_ID,
      txSignature: fakeSig(rng),
      network: "solana-devnet",
      amountUsdc: amount,
      payerWallet: fakeWallet(rng),
      attribution,
      attributionProof:
        attribution === "human"
          ? { source: "seed", note: "demo proof" }
          : null,
      taxDeductible: attribution === "human",
      taxReceiptUrl:
        attribution === "human" ? `https://kalilabs.ai/r/${id}?sig=demo` : null,
      memo,
      programDesignation: rng() < 0.3 ? null : "general support",
      subscriptionId: null,
      syncedToCrm: rng() < 0.7,
      receivedAt,
      seedFlag: true,
    });
  }

  receipts.sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  );

  const outDir = path.join(process.cwd(), "data", "seed", SIZE);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "x402.json");
  await writeFile(
    outPath,
    JSON.stringify({ tenantId: TENANT_ID, receipts }, null, 2),
    "utf8",
  );
  console.log(`✓ wrote ${count} x402 receipts → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
