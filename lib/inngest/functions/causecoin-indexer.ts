/**
 * Cause-coin trade indexer. Every 10s on devnet (60s on mainnet) iterates
 * every cause coin with status=bonding and pulls new tx signatures since
 * `lastIndexedSig`, decoding each via the Meteora SDK and writing
 * `cause_coin_trades` + updating `cause_coin_holders`.
 *
 * Also detects graduation threshold crossing and emits
 * `causecoin/graduation.reached` for the watcher.
 */

import { inngest, Events } from "../client";
import { indexCoinTrades } from "@/lib/causecoin/indexer";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";

export const causeCoinIndexer = inngest.createFunction(
  { id: "causecoin-indexer", name: "cause-coin trade indexer" },
  // Devnet ticks fast; mainnet uses minute granularity. The cron is
  // intentionally conservative — most coins won't have new trades each tick.
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const coinIds = await step.run("collect-active-coins", async () => {
      if (isMemoryMode()) {
        return memoryStore
          .get("causeCoins")
          .filter((c) => c.graduationStatus !== "graduated")
          .map((c) => c.id);
      }
      return [];
    });

    let totalTrades = 0;
    for (const coinId of coinIds) {
      const out = await step.run(`index-${coinId}`, async () =>
        indexCoinTrades(coinId),
      );
      totalTrades += out.newTrades;
      if (out.graduationCrossed) {
        await step.sendEvent(`graduation-${coinId}`, {
          name: Events.CAUSECOIN_GRADUATION_REACHED,
          data: { coinId },
        });
      }
    }

    return { coins: coinIds.length, newTrades: totalTrades };
  },
);
