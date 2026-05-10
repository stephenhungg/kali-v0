/**
 * POST /api/coin/<mint>/buy
 *
 * Browser-initiated buy. Wallet signs locally; we settle via the same
 * `executeBuy` path the agent uses for delegated buys. v1 demo: no real
 * Meteora swap call — we record a simulated trade with realistic-looking
 * numbers so the chart + fees-to-treasury counter advance.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { executeBuy, loadCoin, loadCoinBySymbol } from "@/lib/causecoin/trading";

export const runtime = "nodejs";

const bodySchema = z.object({
  payerWallet: z.string(),
  usdcAmount: z.number().positive().max(100_000),
  payerUserId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  const coin = loadCoin(mint) ?? loadCoinBySymbol(mint);
  if (!coin) {
    return NextResponse.json({ error: "coin not found" }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid body", detail: e instanceof Error ? e.message : "" },
      { status: 400 },
    );
  }

  const result = await executeBuy({
    coin,
    buyerWallet: body.payerWallet,
    usdcAmount: body.usdcAmount,
  });

  return NextResponse.json({
    txSignature: result.txSignature,
    explorerUrl: result.explorerUrl,
    tokensReceived: result.trade.tokenAmount,
    feeUsdc: result.trade.feeUsdc,
    treasuryFeeUsdc: result.trade.treasuryFeeUsdc,
    communityFundFeeUsdc: result.trade.communityFundFeeUsdc,
    priceAfter: result.trade.priceAfter,
    mode: result.mode,
  });
}
