/**
 * GET /api/coin/<mint>
 *
 * Public read-only endpoint returning live market stats + holder summary +
 * recent trades for one cause coin. Used by the public coin trading page,
 * any third-party dashboard, and the agent's tools.
 */

import { NextResponse } from "next/server";
import {
  curveStateFor,
  cumulativeFees,
  listHolders,
  listTrades,
  loadCoin,
  loadCoinBySymbol,
  tradesIn,
} from "@/lib/causecoin/trading";

export const runtime = "nodejs";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

function explorerFor(addr: string, kind: "tx" | "address" = "address"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  const coin = loadCoin(mint) ?? loadCoinBySymbol(mint);
  if (!coin) {
    return NextResponse.json({ error: "coin not found" }, { status: 404 });
  }

  const { config, progression } = curveStateFor(coin);
  const price = config.initialPriceUsdc + config.slope * progression;
  const marketCap = price * config.totalSupply;
  const fees = cumulativeFees(coin.id);
  const holders = listHolders(coin.id);
  const day = tradesIn(coin.id, Date.now() - 86_400_000);
  const recent = listTrades(coin.id, 25).map((t) => ({
    ...t,
    explorerUrl: explorerFor(t.txSignature, "tx"),
  }));

  return NextResponse.json({
    coin: {
      id: coin.id,
      tenantId: coin.tenantId,
      mint: coin.mint,
      symbol: coin.symbol,
      name: coin.name,
      decimals: coin.decimals,
      bondingCurvePool: coin.bondingCurvePool,
      treasuryWallet: coin.treasuryWallet,
      communityFundWallet: coin.communityFundWallet,
      feeBps: coin.feeBps,
      communityFundBps: coin.communityFundBps,
      graduationStatus: coin.graduationStatus,
      graduationThresholdUsd: coin.graduationThresholdUsd,
      ammPool: coin.ammPool,
      lpLockStreamflowId: coin.lpLockStreamflowId,
      metadata: coin.metadata,
      network: coin.network,
      launchedAt: coin.launchedAt,
      explorerUrl: explorerFor(coin.mint),
      poolExplorerUrl: explorerFor(coin.bondingCurvePool),
    },
    market: {
      priceUsdc: price,
      marketCapUsd: marketCap,
      volume24hUsd: day.reduce((s, t) => s + t.usdcAmount, 0),
      trades24h: day.length,
      holderCount: holders.length,
      cumulativeFeesToTreasuryUsd: fees.treasury,
      cumulativeFeesToCommunityFundUsd: fees.communityFund,
      graduationProgressPct: Math.min(
        100,
        (marketCap / coin.graduationThresholdUsd) * 100,
      ),
    },
    recentTrades: recent,
    topHolders: holders.slice(0, 10),
  });
}
