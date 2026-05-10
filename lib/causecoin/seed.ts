/**
 * Boot-time loader. Reads `data/seed/<size>/causecoin.json` (and `x402.json`)
 * into the memory store so the demo has rich data without requiring scripts
 * to run before each `next dev`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  isMemoryMode,
  memoryStore,
  type MemX402Receipt,
  type MemCauseCoin,
  type MemCauseCoinHolder,
  type MemCauseCoinTrade,
} from "@/lib/db/memory";
import { registerWalletLink } from "./wallet-links";

let loaded = false;

interface CauseCoinSeed {
  causeCoin: MemCauseCoin;
  holders: MemCauseCoinHolder[];
  trades: MemCauseCoinTrade[];
  walletLinks: Array<{ wallet: string; kali_entity_id: string; coinId: string; boundAt: string; source: "seed" }>;
}

interface X402Seed {
  tenantId: string;
  receipts: MemX402Receipt[];
}

export async function loadAllSeeds(size?: string): Promise<{
  receiptsLoaded: number;
  coinsLoaded: number;
  holdersLoaded: number;
  tradesLoaded: number;
  walletLinks: number;
}> {
  if (loaded || !isMemoryMode()) {
    return { receiptsLoaded: 0, coinsLoaded: 0, holdersLoaded: 0, tradesLoaded: 0, walletLinks: 0 };
  }
  const sz = size ?? process.env.KALI_SEED_SIZE ?? "medium";
  const root = path.join(process.cwd(), "data", "seed", sz);

  const out = { receiptsLoaded: 0, coinsLoaded: 0, holdersLoaded: 0, tradesLoaded: 0, walletLinks: 0 };

  // x402 receipts. Idempotent: skip rows whose id is already in the store
  // (HMR re-evaluates this module without resetting `loaded` cleanly).
  try {
    const raw = await readFile(path.join(root, "x402.json"), "utf8");
    const parsed = JSON.parse(raw) as X402Seed;
    const receipts = memoryStore.get("receipts");
    const seen = new Set(receipts.map((r) => r.id));
    for (const r of parsed.receipts ?? []) {
      if (seen.has(r.id)) continue;
      receipts.push(r);
      seen.add(r.id);
      out.receiptsLoaded += 1;
    }
  } catch {
    /* missing seed is fine */
  }

  // Cause coin. Same idempotency: skip rows whose id is already present.
  try {
    const raw = await readFile(path.join(root, "causecoin.json"), "utf8");
    const parsed = JSON.parse(raw) as CauseCoinSeed;
    const coins = memoryStore.get("causeCoins");
    if (parsed.causeCoin && !coins.some((c) => c.id === parsed.causeCoin.id)) {
      coins.push(parsed.causeCoin);
      out.coinsLoaded = 1;
    }
    const holders = memoryStore.get("causeCoinHolders");
    const holderKey = (h: { coinId: string; wallet: string }) => `${h.coinId}::${h.wallet}`;
    const holderSeen = new Set(holders.map(holderKey));
    for (const h of parsed.holders ?? []) {
      if (holderSeen.has(holderKey(h))) continue;
      holders.push(h);
      holderSeen.add(holderKey(h));
      out.holdersLoaded += 1;
    }
    const trades = memoryStore.get("causeCoinTrades");
    const tradeSeen = new Set(trades.map((t) => t.id));
    for (const t of parsed.trades ?? []) {
      if (tradeSeen.has(t.id)) continue;
      trades.push(t);
      tradeSeen.add(t.id);
      out.tradesLoaded += 1;
    }
    for (const link of parsed.walletLinks ?? []) {
      registerWalletLink(link);
    }
    out.walletLinks = parsed.walletLinks?.length ?? 0;
  } catch {
    /* missing seed is fine */
  }

  loaded = true;
  return out;
}

export function __resetSeedLoadedForTest(): void {
  loaded = false;
}
