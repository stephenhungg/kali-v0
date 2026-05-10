/**
 * Public x402 payment endpoint.
 *
 *   GET  /api/x402/<tenant>            → 402 with accepts[] (no payment yet)
 *   GET  /api/x402/<tenant>            → 200 + receipt (X-Payment header set)
 *   POST /api/x402/<tenant>            → same as GET-with-header
 *
 * The path lives at /api/x402 because Next.js handles /api/* outside the
 * subdomain rewriter. In production, pay.kalilabs.ai/<tenant> reverse-
 * proxies (or middleware-rewrites) to /api/x402/<tenant>. Locally you can
 * call this URL directly.
 *
 * Spec: data/x402-nonprofit-donations.md §4.1
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

const USDC_MINT =
  NETWORK === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface RouteParams {
  params: Promise<{ tenant: string }>;
}

async function buildAccepts(tenantSlug: string) {
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return null;
  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  return {
    tenant,
    accepts: x402AcceptsSchema.parse({
      scheme: "exact",
      network: NETWORK,
      asset: USDC_MINT,
      payTo: treasury.pubkey,
      maxAmountRequired: "100000000", // $100
      minAmountRequired: "1000000", // $1
      description: `Donate to ${tenant.name}`,
      mimeType: "application/json",
      outputSchema: { $ref: "https://kalilabs.ai/schemas/x402-receipt.json" },
      extra: {
        kali_entity_id: tenant.id,
        ein: tenant.ein,
        tax_status: tenant.taxStatus ?? "501(c)(3)",
        min_human_amount: "1000000",
        min_autonomous_amount: "100000",
      },
    }),
  };
}

async function handle(req: Request, { params }: RouteParams): Promise<Response> {
  const { tenant: tenantSlug } = await params;
  const built = await buildAccepts(tenantSlug);
  if (!built) {
    return NextResponse.json(
      { error: `unknown tenant: ${tenantSlug}` },
      { status: 404 },
    );
  }

  const xPayment = req.headers.get("x-payment") ?? req.headers.get("X-Payment");

  if (!xPayment) {
    const body: X402Response = {
      x402Version: 1,
      accepts: [built.accepts],
      error: null,
    };
    return new NextResponse(JSON.stringify(body), {
      status: 402,
      headers: { "content-type": "application/json" },
    });
  }

  // Verify the payment.
  const verified = await verifyPayment(xPayment, {
    network: NETWORK,
    asset: USDC_MINT,
    payToWallet: built.accepts.payTo,
    minAmount: BigInt(built.accepts.minAmountRequired),
    maxAmount: BigInt(built.accepts.maxAmountRequired),
  });

  if (!verified.ok) {
    const body: X402Response = {
      x402Version: 1,
      accepts: [built.accepts],
      error: `${verified.code}: ${verified.reason}`,
    };
    return new NextResponse(JSON.stringify(body), {
      status: 402,
      headers: { "content-type": "application/json" },
    });
  }

  // OFAC / sanctions check (fail-closed if KALI_TRM_REQUIRED=true).
  const screen = await screenWallet(verified.payerWallet);
  if (screen.flagged && screen.severity === "high") {
    return NextResponse.json(
      {
        error: "payer wallet flagged",
        reason: screen.reason,
      },
      { status: 451 },
    );
  }

  // Settle via the configured facilitator.
  const facilitator = getFacilitator();
  const settled = await facilitator.settle({
    signedTx: verified.signedTx,
    network: verified.network,
  });

  if (!settled.ok) {
    return NextResponse.json(
      {
        error: "settlement failed",
        reason: settled.reason,
        facilitator: facilitator.kind,
      },
      { status: 502 },
    );
  }

  // Classify attribution for tax purposes.
  const cls = classifyAttribution({
    payerWallet: verified.payerWallet,
    metadata: verified.metadata,
  });

  // Mint receipt.
  const receipt = await issueReceipt({
    tenantId: built.tenant.id,
    tenantKaliEntityId: built.tenant.id,
    txSignature: settled.txSignature || verified.txSignature,
    network: verified.network,
    amountUsdc: Number(verified.amount) / 1_000_000,
    payerWallet: verified.payerWallet,
    attribution: cls.attribution,
    attributionProof: cls.proof,
    taxDeductible: cls.taxDeductible,
    memo: verified.metadata.memo ?? null,
    programDesignation: verified.metadata.program_designation ?? null,
  });

  const responseBody = JSON.stringify({ receipt });
  const xPaymentResponse = Buffer.from(responseBody, "utf8").toString("base64");

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-payment-response": xPaymentResponse,
    },
  });
}

export async function GET(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}

export async function POST(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}
