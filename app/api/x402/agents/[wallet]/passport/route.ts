/**
 * GET /api/x402/agents/<wallet>/passport
 *
 * Public passport endpoint for autonomous agent wallets. Surfaces total
 * giving, causes supported, attestations from foundations.
 */

import { NextResponse } from "next/server";
import { listTopPhilanthropicAgents, getPassport } from "@/lib/x402/agent-passport";
import "@/lib/agent/registrations"; // ensures connectors run init + seeds load

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  // Force the rebuild-from-receipts path so seed receipts are reflected.
  void listTopPhilanthropicAgents();
  const passport = getPassport(wallet);
  if (!passport) {
    return NextResponse.json({ error: "no passport found for wallet" }, { status: 404 });
  }
  return NextResponse.json({
    passport,
    profile_url: `https://kalilabs.ai/agents/${passport.passportId}`,
  });
}
