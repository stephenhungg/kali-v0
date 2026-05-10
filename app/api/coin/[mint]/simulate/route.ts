/**
 * GET /api/coin/<mint>/simulate?usdc=<amount>
 *
 * Real bonding-curve quote for a given USDC notional. Used by the
 * TradePanel preview so the displayed tokens-out / price-after / fee split
 * is grounded in the same math executeBuy uses, not a client-side estimate.
 */

import { NextResponse } from "next/server";
import {
  loadCoin,
  loadCoinBySymbol,
  simulateBuy,
} from "@/lib/causecoin/trading";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  const coin = loadCoin(mint) ?? loadCoinBySymbol(mint);
  if (!coin) {
    return NextResponse.json({ error: "coin not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const usdc = Number(url.searchParams.get("usdc") ?? "0");
  if (!Number.isFinite(usdc) || usdc <= 0) {
    return NextResponse.json(
      { error: "usdc must be a positive number" },
      { status: 400 },
    );
  }
  const q = simulateBuy(coin, usdc);
  return NextResponse.json({
    tokensOut: q.tokensOut,
    priceBefore: q.priceBefore,
    priceAfter: q.priceAfter,
    feeUsdc: q.feeUsdc,
    treasuryFeeUsdc: q.treasuryFeeUsdc,
    communityFundFeeUsdc: q.communityFundFeeUsdc,
    slippagePct: q.slippagePct,
    newProgression: q.newProgression,
    newMarketCapUsd: q.newMarketCapUsd,
    feeBps: coin.feeBps,
    communityFundBps: coin.communityFundBps,
  });
}
