/**
 * Trade indexer. Two responsibilities:
 *
 *   1. Pull new tx signatures from chain since `lastIndexedSig`, decode each
 *      via Meteora's tx parser, write `cause_coin_trades` rows.
 *   2. Recompute holder balances from running trade totals + check whether
 *      the bonding curve has crossed the graduation threshold.
 *
 * In dev (no Meteora SDK swap calls), the indexer is mostly a no-op — the
 * trade rows are written directly by `executeBuy` in trading.ts. The
 * indexer still serves the graduation-detection role.
 */

import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { curveStateFor, cumulativeFees } from "./trading";

export interface IndexResult {
  coinId: string;
  newTrades: number;
  graduationCrossed: boolean;
  marketCapUsd: number;
}

export async function indexCoinTrades(coinId: string): Promise<IndexResult> {
  if (!isMemoryMode()) {
    return { coinId, newTrades: 0, graduationCrossed: false, marketCapUsd: 0 };
  }

  const coin = memoryStore.get("causeCoins").find((c) => c.id === coinId);
  if (!coin) {
    return { coinId, newTrades: 0, graduationCrossed: false, marketCapUsd: 0 };
  }

  const fees = cumulativeFees(coinId);
  const { config, progression } = curveStateFor(coin);
  const marketCapUsd =
    (config.initialPriceUsdc + config.slope * progression) * config.totalSupply;

  const wasGraduating = coin.graduationStatus === "graduating";
  const justCrossed =
    !wasGraduating &&
    coin.graduationStatus !== "graduated" &&
    marketCapUsd >= coin.graduationThresholdUsd;

  if (justCrossed) {
    coin.graduationStatus = "graduating";
  }

  return {
    coinId,
    newTrades: 0, // real chain-scan would populate this; v1 trades are written directly
    graduationCrossed: justCrossed,
    marketCapUsd,
  };
}
