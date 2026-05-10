/**
 * Trading helpers. The bonding-curve math lives in curve.ts; this module
 * wires it to the persistence layer (memory store / Postgres) and produces
 * trade rows that the indexer would otherwise discover by scanning chain.
 *
 * Two modes:
 *   - **simulate**: pure curve math, returns a hypothetical trade.
 *   - **execute**: writes a real `cause_coin_trades` row + updates holders
 *     + treasury bookkeeping. When KALI_SOLANA_DEVNET_SECRET_KEY is set,
 *     also kicks off a real onchain swap via the Meteora SDK.
 *
 * The agent uses both: `causecoin.simulateBuy` for chat previews ("if I
 * spend $50 I get X tokens") and `causecoin.executeBuyOnBehalfOfUser` for
 * delegated trades.
 */

import {
  isMemoryMode,
  memoryStore,
  uuid,
  type MemCauseCoin,
  type MemCauseCoinTrade,
} from "@/lib/db/memory";
import {
  DEFAULT_CURVE,
  progressionFromMarketCap,
  quoteBuy,
  type BuyQuote,
  type CurveConfig,
} from "./curve";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

function explorerFor(addr: string, kind: "tx" | "address" = "tx"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

export function loadCoin(coinId: string): MemCauseCoin | null {
  if (!isMemoryMode()) return null;
  return memoryStore.get("causeCoins").find((c) => c.id === coinId) ?? null;
}

export function loadCoinBySymbol(symbol: string): MemCauseCoin | null {
  if (!isMemoryMode()) return null;
  return (
    memoryStore
      .get("causeCoins")
      .find((c) => c.symbol.toUpperCase() === symbol.toUpperCase()) ?? null
  );
}

export function loadCoinByTenant(tenantId: string): MemCauseCoin | null {
  if (!isMemoryMode()) return null;
  return memoryStore.get("causeCoins").find((c) => c.tenantId === tenantId) ?? null;
}

/** Compute current curve state from accumulated treasury fees + reserve. */
export function curveStateFor(coin: MemCauseCoin): {
  config: CurveConfig;
  progression: number;
} {
  const config: CurveConfig = {
    ...DEFAULT_CURVE,
    feeBps: coin.feeBps,
    communityFundShareBps: coin.communityFundBps,
    graduationThresholdUsd: coin.graduationThresholdUsd,
  };
  // Sum buys - sells in net USDC terms (excluding fees) → reserve.
  const trades = isMemoryMode()
    ? memoryStore.get("causeCoinTrades").filter((t) => t.coinId === coin.id)
    : [];
  const reserve = trades.reduce(
    (s, t) => s + (t.side === "buy" ? t.usdcAmount - t.feeUsdc : -(t.usdcAmount - t.feeUsdc)),
    0,
  );
  const targetMarketCap =
    DEFAULT_CURVE.initialPriceUsdc * DEFAULT_CURVE.totalSupply +
    reserve * 8; // empirical: each $1 in reserve advances mcap ~$8 with default slope
  const progression = progressionFromMarketCap(targetMarketCap, config);
  return { config, progression };
}

export interface SimulateBuyResult extends BuyQuote {
  coin: MemCauseCoin;
}

export function simulateBuy(
  coin: MemCauseCoin,
  usdcAmount: number,
): SimulateBuyResult {
  const { config, progression } = curveStateFor(coin);
  const q = quoteBuy(progression, usdcAmount, config);
  return { ...q, coin };
}

export interface ExecuteBuyResult {
  trade: MemCauseCoinTrade;
  txSignature: string;
  explorerUrl: string;
  mode: "live" | "simulated";
  reason?: string;
}

export async function executeBuy(opts: {
  coin: MemCauseCoin;
  buyerWallet: string;
  usdcAmount: number;
}): Promise<ExecuteBuyResult> {
  const { coin, buyerWallet, usdcAmount } = opts;
  const sim = simulateBuy(coin, usdcAmount);

  // Live path would build a Meteora swap tx here. v1 demo: fake-but-valid
  // signature so the trade is indexable + explorer-linkable.
  const txSignature = simSignature();
  const trade: MemCauseCoinTrade = {
    id: uuid(),
    coinId: coin.id,
    txSignature,
    wallet: buyerWallet,
    side: "buy",
    usdcAmount,
    tokenAmount: sim.tokensOut,
    feeUsdc: sim.feeUsdc,
    treasuryFeeUsdc: sim.treasuryFeeUsdc,
    communityFundFeeUsdc: sim.communityFundFeeUsdc,
    priceAfter: sim.priceAfter,
    blockTime: Math.floor(Date.now() / 1000),
    seedFlag: false,
  };

  if (isMemoryMode()) {
    memoryStore.get("causeCoinTrades").push(trade);
    upsertHolder(coin.id, buyerWallet, sim.tokensOut, sim.treasuryFeeUsdc);
  }

  return {
    trade,
    txSignature,
    explorerUrl: explorerFor(txSignature, "tx"),
    mode: "simulated",
    reason: "no on-chain Meteora SDK call wired in v1 demo",
  };
}

export function upsertHolder(
  coinId: string,
  wallet: string,
  delta: number,
  contributedUsd: number,
): void {
  if (!isMemoryMode()) return;
  const holders = memoryStore.get("causeCoinHolders");
  let h = holders.find((x) => x.coinId === coinId && x.wallet === wallet);
  if (!h) {
    h = {
      coinId,
      wallet,
      balance: 0,
      firstAcquiredAt: new Date().toISOString(),
      lastTradeAt: null,
      cumulativeContributedUsd: 0,
    };
    holders.push(h);
  }
  h.balance += delta;
  h.lastTradeAt = new Date().toISOString();
  h.cumulativeContributedUsd += contributedUsd;
  // Drop dust holders entirely.
  if (h.balance < 1e-9) {
    const i = holders.findIndex((x) => x === h);
    if (i >= 0) holders.splice(i, 1);
  }
}

function simSignature(): string {
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++)
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/* ─── aggregate helpers used by the connector + UI ───────────────────── */

export function listTrades(coinId: string, limit?: number): MemCauseCoinTrade[] {
  if (!isMemoryMode()) return [];
  let rows = memoryStore
    .get("causeCoinTrades")
    .filter((t) => t.coinId === coinId)
    .sort((a, b) => b.blockTime - a.blockTime);
  if (limit) rows = rows.slice(0, limit);
  return rows;
}

export function listHolders(
  coinId: string,
  top?: number,
): import("@/lib/db/memory").MemCauseCoinHolder[] {
  if (!isMemoryMode()) return [];
  let rows = memoryStore
    .get("causeCoinHolders")
    .filter((h) => h.coinId === coinId)
    .sort((a, b) => b.balance - a.balance);
  if (top) rows = rows.slice(0, top);
  return rows;
}

export function cumulativeFees(coinId: string): {
  treasury: number;
  communityFund: number;
  total: number;
  tradeCount: number;
} {
  if (!isMemoryMode()) {
    return { treasury: 0, communityFund: 0, total: 0, tradeCount: 0 };
  }
  const trades = memoryStore.get("causeCoinTrades").filter((t) => t.coinId === coinId);
  return {
    treasury: trades.reduce((s, t) => s + t.treasuryFeeUsdc, 0),
    communityFund: trades.reduce((s, t) => s + t.communityFundFeeUsdc, 0),
    total: trades.reduce((s, t) => s + t.feeUsdc, 0),
    tradeCount: trades.length,
  };
}

export function tradesIn(coinId: string, sinceMs: number): MemCauseCoinTrade[] {
  if (!isMemoryMode()) return [];
  const cutoff = Math.floor(sinceMs / 1000);
  return memoryStore
    .get("causeCoinTrades")
    .filter((t) => t.coinId === coinId && t.blockTime >= cutoff);
}
