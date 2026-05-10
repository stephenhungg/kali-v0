/**
 * Public receipt route. Two formats:
 *
 *   GET /r/<id>?sig=<sig>            → application/pdf (downloadable receipt)
 *   GET /r/<id>?sig=<sig> + Accept: application/json
 *                                    → JSON payload (for 3rd-party verifiers)
 *
 * Tampered or missing signatures return 403. The signing logic lives in
 * lib/x402/url-sign.ts so the same key can be rotated without changing
 * verifier code.
 */

import { NextResponse } from "next/server";
import { getReceipt, toWireReceipt } from "@/lib/x402/receipt";
import { verifyReceiptSig } from "@/lib/x402/url-sign";
import { generateReceiptPdf } from "@/lib/x402/pdf-receipt";
import { resolveTenant } from "@/lib/tenants";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await params;
  const url = new URL(req.url);
  const sig = url.searchParams.get("sig") ?? "";

  const receipt = await getReceipt(receiptId);
  if (!receipt) {
    return NextResponse.json({ error: "receipt not found" }, { status: 404 });
  }
  if (!receipt.taxDeductible) {
    return NextResponse.json(
      { error: "this receipt is not tax-deductible — no PDF issued" },
      { status: 410 },
    );
  }

  const valid = verifyReceiptSig(
    {
      id: receipt.id,
      tenantId: receipt.tenantId,
      amount: receipt.amountUsdc,
      attribution: receipt.attribution,
    },
    sig,
  );
  if (!valid) {
    return NextResponse.json(
      { error: "signature mismatch", receiptId },
      { status: 403 },
    );
  }

  const tenant = await resolveTenant(receipt.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "tenant lookup failed" }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({
      receipt: toWireReceipt(receipt, tenant.id),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        ein: tenant.ein,
        taxStatus: tenant.taxStatus,
        city: tenant.city,
        state: tenant.state,
        website: tenant.website,
      },
    });
  }

  const publicUrl = `${url.origin}/r/${receipt.id}?sig=${sig}`;
  const pdf = await generateReceiptPdf({ receipt, tenant, publicReceiptUrl: publicUrl });

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="kali-receipt-${receipt.id}.pdf"`,
      "cache-control": "private, max-age=60",
    },
  });
}
