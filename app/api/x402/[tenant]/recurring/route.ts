/**
 * Recurring x402 subscription endpoint.
 *
 *   POST /api/x402/<tenant>/recurring
 *   Body: { amount, period, delegationProof, payerWallet, memo?, programDesignation? }
 *
 * The first charge runs immediately (proves intent + funds). Subsequent
 * charges happen via the Inngest cron in lib/inngest/functions/x402-recurring.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/x402/recurring";
import { inngest, Events } from "@/lib/inngest/client";
import { resolveTenant } from "@/lib/tenants";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountUsdc: z.number().positive(),
  period: z.enum(["weekly", "monthly"]),
  payerWallet: z.string(),
  delegationProof: z.object({
    userId: z.string(),
    walletPubkey: z.string(),
    scope: z.string(),
    expiresAt: z.number(),
    nonce: z.string(),
    signature: z.string(),
  }),
  memo: z.string().optional(),
  programDesignation: z.string().optional(),
  startAt: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
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

  const sub = await createSubscription({
    tenantId: tenant.id,
    payerWallet: body.payerWallet,
    amountUsdc: body.amountUsdc,
    period: body.period,
    delegationProof: body.delegationProof,
    memo: body.memo,
    programDesignation: body.programDesignation,
    startAt: body.startAt ? new Date(body.startAt) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
  });

  // Kick off the first charge via Inngest. If Inngest isn't running we
  // still return a 200 so the client sees the subscription was accepted.
  try {
    await inngest.send({
      name: Events.X402_SUBSCRIPTION_CREATED,
      data: { subscriptionId: sub.id },
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json({
    subscriptionId: sub.id,
    nextChargeAt: sub.nextChargeAt,
    period: sub.period,
    amountUsdc: sub.amountUsdc,
    status: sub.status,
  });
}
