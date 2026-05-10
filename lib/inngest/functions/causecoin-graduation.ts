/**
 * Graduation watcher. Triggered by `causecoin/graduation.reached` from the
 * indexer. Migrates the bonding curve to a Meteora DAMMv2 pool, locks the
 * resulting LP tokens via Streamflow for 12 months, and updates the coin's
 * row to `graduated`.
 */

import { inngest, Events } from "../client";
import { graduateCoin } from "@/lib/causecoin/graduation";

export const causeCoinGraduationWatcher = inngest.createFunction(
  { id: "causecoin-graduation-watcher", name: "cause-coin graduation watcher" },
  { event: Events.CAUSECOIN_GRADUATION_REACHED },
  async ({ event, step }) => {
    const coinId = (event.data as { coinId: string }).coinId;
    const out = await step.run(`graduate-${coinId}`, async () =>
      graduateCoin(coinId),
    );
    return out;
  },
);
