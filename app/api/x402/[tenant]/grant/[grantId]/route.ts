/**
 * Foundation → nonprofit grant disbursement endpoint. A foundation agent
 * (Open Society, Hewlett, etc) hits this URL to disburse against a known
 * grant id. The receipt is tagged `programDesignation=grant:<grantId>`
 * so downstream Instrumentl + Bloomerang reconciliation can mark the
 * grant as disbursed.
 *
 * Same x402 protocol as donations — the only difference is the receipt's
 * memo embeds the grant id and the audit trail explicitly records this
 * as `type='foundation_grant_via_x402'`.
 */

import { NextResponse } from "next/server";
import {
  x402AcceptsSchema,
  type X402Response,
} from "@/lib/connectors/x402.schema";
import { verifyPayment, screenWallet } from "@/lib/x402/verifier";
import { getFacilitator } from "@/lib/x402/facilitator";
import { issueReceipt } from "@/lib/x402/receipt";
import { classifyAttribution } from "@/lib/x402/attribution";
import { getOrCreateTreasuryWallet } from "@/lib/wallets/privy";
import { resolveTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";
const USDC =
  NETWORK === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface RouteParams {
  params: Promise<{ tenant: string; grantId: string }>;
}

async function handle(req: Request, { params }: RouteParams) {
  const { tenant: tenantSlug, grantId } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  const accepts = x402AcceptsSchema.parse({
    scheme: "exact",
    network: NETWORK,
    asset: USDC,
    payTo: treasury.pubkey,
    // Foundation grants can be much larger than retail donations — relax bounds.
    maxAmountRequired: "1000000000000", // $1M
    minAmountRequired: "100000000", // $100
    description: `Foundation grant disbursement to ${tenant.name} (grant ${grantId})`,
    mimeType: "application/json",
    extra: {
      kali_entity_id: tenant.id,
      ein: tenant.ein,
      tax_status: tenant.taxStatus,
      grant_id: grantId,
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
    asset: USDC,
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
    return NextResponse.json({ error: "payer flagged", reason: screen.reason }, { status: 451 });
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

  // Foundation grants are normally autonomous (foundation agent) but the
  // receipt is still NOT tax-deductible (foundation already received its
  // deduction at the original grant point).
  const cls = classifyAttribution({
    payerWallet: verified.payerWallet,
    metadata: verified.metadata,
  });
  const taxDeductible = false; // foundation grants aren't deductible to the recipient.

  const receipt = await issueReceipt({
    tenantId: tenant.id,
    tenantKaliEntityId: tenant.id,
    txSignature: settled.txSignature || verified.txSignature,
    network: verified.network,
    amountUsdc: Number(verified.amount) / 1_000_000,
    payerWallet: verified.payerWallet,
    attribution: cls.attribution,
    attributionProof: cls.proof,
    taxDeductible,
    memo: `foundation_grant_via_x402:${grantId} ${verified.metadata.memo ?? ""}`.trim(),
    programDesignation: `grant:${grantId}`,
  });

  return NextResponse.json({ receipt, grant: { id: grantId, disbursed: true } });
}

export async function GET(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}
export async function POST(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}
