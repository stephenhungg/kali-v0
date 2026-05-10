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

  // x402 receipts.
  try {
    const raw = await readFile(path.join(root, "x402.json"), "utf8");
    const parsed = JSON.parse(raw) as X402Seed;
    for (const r of parsed.receipts ?? []) {
      memoryStore.get("receipts").push(r);
    }
    out.receiptsLoaded = parsed.receipts?.length ?? 0;
  } catch {
    /* missing seed is fine */
  }

  // Cause coin.
  try {
    const raw = await readFile(path.join(root, "causecoin.json"), "utf8");
    const parsed = JSON.parse(raw) as CauseCoinSeed;
    if (parsed.causeCoin) {
      memoryStore.get("causeCoins").push(parsed.causeCoin);
      out.coinsLoaded = 1;
    }
    for (const h of parsed.holders ?? []) {
      memoryStore.get("causeCoinHolders").push(h);
    }
    out.holdersLoaded = parsed.holders?.length ?? 0;
    for (const t of parsed.trades ?? []) {
      memoryStore.get("causeCoinTrades").push(t);
    }
    out.tradesLoaded = parsed.trades?.length ?? 0;
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
