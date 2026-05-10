/**
 * POST /api/coin/launch
 *
 * Admin-only endpoint that deploys a new cause coin for a tenant. Mirrors
 * what the agent invokes via `causecoin.launch` but exposed as a plain
 * REST endpoint so the dashboard "launch" button can call it directly.
 *
 * Body: { tenantSlug, symbol, name, cause? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/lib/tenants";
import { launchCauseCoin } from "@/lib/causecoin/deploy";

export const runtime = "nodejs";

const bodySchema = z.object({
  tenantSlug: z.string(),
  symbol: z.string().regex(/^[A-Z]{2,8}$/),
  name: z.string().min(1).max(64),
  cause: z.string().optional(),
  feeBps: z.number().int().min(0).max(500).optional(),
  communityFundBps: z.number().int().min(0).max(5000).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid body", detail: e instanceof Error ? e.message : "" },
      { status: 400 },
    );
  }

  const tenant = await resolveTenant(body.tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const result = await launchCauseCoin(tenant, {
    symbol: body.symbol,
    name: body.name,
    cause: body.cause,
    feeBps: body.feeBps,
    communityFundBps: body.communityFundBps,
  });

  return NextResponse.json({
    coinId: result.coin.id,
    mint: result.coin.mint,
    symbol: result.coin.symbol,
    bondingCurvePool: result.coin.bondingCurvePool,
    treasuryWallet: result.coin.treasuryWallet,
    explorerUrls: result.explorerUrls,
    message: result.message,
  });
}
