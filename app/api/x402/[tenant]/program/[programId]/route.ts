/**
 * Program-restricted donation endpoint. Same x402 protocol but the receipt
 * is tagged with `programDesignation` so the agent's "donate to Workforce
 * Development specifically" flow has a stable URL to point at.
 */

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenants";
import {
  x402AcceptsSchema,
  type X402Response,
} from "@/lib/connectors/x402.schema";
import { verifyPayment, screenWallet } from "@/lib/x402/verifier";
import { getFacilitator } from "@/lib/x402/facilitator";
import { issueReceipt } from "@/lib/x402/receipt";
import { classifyAttribution } from "@/lib/x402/attribution";
import { getOrCreateTreasuryWallet } from "@/lib/wallets/privy";

export const runtime = "nodejs";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";
const USDC_MINT =
  NETWORK === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface RouteParams {
  params: Promise<{ tenant: string; programId: string }>;
}

async function handle(req: Request, { params }: RouteParams) {
  const { tenant: tenantSlug, programId } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }
  if (!tenant.programs.some((p) => p.toLowerCase().replace(/\s+/g, "-") === programId)) {
    return NextResponse.json(
      { error: `program ${programId} not found for ${tenantSlug}` },
      { status: 404 },
    );
  }
  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  const accepts = x402AcceptsSchema.parse({
    scheme: "exact",
    network: NETWORK,
    asset: USDC_MINT,
    payTo: treasury.pubkey,
    maxAmountRequired: "100000000",
    minAmountRequired: "1000000",
    description: `Donate to ${tenant.name} → ${programId}`,
    mimeType: "application/json",
    extra: {
      kali_entity_id: tenant.id,
      ein: tenant.ein,
      tax_status: tenant.taxStatus,
      program_designation: programId,
    },
  });

  const xPayment = req.headers.get("x-payment") ?? req.headers.get("X-Payment");
  if (!xPayment) {
    const body: X402Response = { x402Version: 1, accepts: [accepts], error: null };
    return new NextResponse(JSON.stringify(body), {
      status: 402,
      headers: { "content-type": "application/json" },
    });
  }
  const verified = await verifyPayment(xPayment, {
    network: NETWORK,
    asset: USDC_MINT,
    payToWallet: accepts.payTo,
    minAmount: BigInt(accepts.minAmountRequired),
    maxAmount: BigInt(accepts.maxAmountRequired),
  });
  if (!verified.ok) {
    return new NextResponse(
      JSON.stringify({
        x402Version: 1,
        accepts: [accepts],
        error: `${verified.code}: ${verified.reason}`,
      }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }
  const screen = await screenWallet(verified.payerWallet);
  if (screen.flagged && screen.severity === "high") {
    return NextResponse.json(
      { error: "payer flagged", reason: screen.reason },
      { status: 451 },
    );
  }
  const settled = await getFacilitator().settle({
    signedTx: verified.signedTx,
    network: verified.network,
  });
  if (!settled.ok) {
    return NextResponse.json(
      { error: "settlement failed", reason: settled.reason },
      { status: 502 },
    );
  }
  const cls = classifyAttribution({
    payerWallet: verified.payerWallet,
    metadata: verified.metadata,
  });
  const receipt = await issueReceipt({
    tenantId: tenant.id,
    tenantKaliEntityId: tenant.id,
    txSignature: settled.txSignature || verified.txSignature,
    network: verified.network,
    amountUsdc: Number(verified.amount) / 1_000_000,
    payerWallet: verified.payerWallet,
    attribution: cls.attribution,
    attributionProof: cls.proof,
    taxDeductible: cls.taxDeductible,
    memo: verified.metadata.memo ?? null,
    programDesignation: programId,
  });
  return NextResponse.json({ receipt });
}

export async function GET(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}
export async function POST(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}
