/**
 * Graduation handler. When the bonding curve crosses the threshold market
 * cap (default $69K), this function:
 *
 *   1. Calls Meteora DBC's migrateToDamm to spin up a DAMMv2 pool.
 *   2. Mints LP tokens from the residual reserve to the platform wallet.
 *   3. Streamflow-locks the LP for 12 months, beneficiary = community fund
 *      wallet (so when the lock expires, the public-good owner has the
 *      tokens — the cause foundation, not Kali).
 *   4. Hooks the AMM fee redirector so 1% of post-graduation trades still
 *      route to the treasury.
 *   5. Marks the coin row `graduated` and persists the AMM pool address +
 *      Streamflow lock id (publicly verifiable URL).
 *
 * For v1 (no live Meteora swap calls in the dev demo), we fast-forward
 * steps 1-4 to populate the row with deterministic-looking addresses so
 * the UI shows the graduation badge + "LP locked until 2027" link.
 */

import {
  isMemoryMode,
  memoryStore,
  type MemCauseCoin,
} from "@/lib/db/memory";
import { Keypair } from "@solana/web3.js";

export interface GraduationResult {
  coinId: string;
  graduated: boolean;
  ammPool: string | null;
  lpLockStreamflowId: string | null;
  reason?: string;
}

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

export async function graduateCoin(coinId: string): Promise<GraduationResult> {
  if (!isMemoryMode()) {
    return { coinId, graduated: false, ammPool: null, lpLockStreamflowId: null, reason: "no memory store" };
  }

  const coin: MemCauseCoin | undefined = memoryStore
    .get("causeCoins")
    .find((c) => c.id === coinId);
  if (!coin) {
    return { coinId, graduated: false, ammPool: null, lpLockStreamflowId: null, reason: "coin not found" };
  }
  if (coin.graduationStatus === "graduated") {
    return {
      coinId,
      graduated: true,
      ammPool: coin.ammPool,
      lpLockStreamflowId: coin.lpLockStreamflowId,
      reason: "already graduated",
    };
  }

  // Real flow: Meteora SDK migrateToDamm + Streamflow createStream. v1 stub:
  const ammPoolKp = Keypair.generate();
  const lockId = `sf_${ammPoolKp.publicKey.toBase58().slice(0, 12)}`;

  coin.graduationStatus = "graduated";
  coin.ammPool = ammPoolKp.publicKey.toBase58();
  coin.lpLockStreamflowId = lockId;

  return {
    coinId,
    graduated: true,
    ammPool: coin.ammPool,
    lpLockStreamflowId: coin.lpLockStreamflowId,
  };
}

export function streamflowLockUrl(lockId: string): string {
  const base = NETWORK === "solana-mainnet"
    ? "https://app.streamflow.finance/contract"
    : "https://devnet.streamflow.finance/contract";
  return `${base}/${lockId}`;
}
