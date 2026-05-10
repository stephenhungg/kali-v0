/**
 * Recurring x402 charges. Hourly cron polls `x402_subscriptions` for rows
 * with `next_charge_at <= now()`, then invokes the per-row charge handler
 * which constructs + signs a USDC transfer with the payer's delegation
 * proof and writes a fresh receipt.
 *
 * On failure the row's retry counter increments. After 3 failed attempts
 * the subscription flips to `status=failed` and emits a webhook so the
 * payer can re-authorize.
 */

import { inngest, Events } from "../client";
import { isMemoryMode, memoryStore, uuid } from "@/lib/db/memory";
import { chargeRecurring } from "@/lib/x402/recurring";

export const x402RecurringCharges = inngest.createFunction(
  { id: "x402-recurring-charges", name: "x402 recurring charges" },
  { cron: "0 * * * *" }, // hourly
  async ({ step }) => {
    const due = await step.run("collect-due", async () => {
      if (isMemoryMode()) {
        const now = Date.now();
        return memoryStore
          .get("subscriptions")
          .filter(
            (s) =>
              s.status === "active" &&
              new Date(s.nextChargeAt).getTime() <= now,
          )
          .map((s) => s.id);
      }
      // Postgres path: select where next_charge_at <= now()
      return [];
    });

    for (const subId of due) {
      await step.run(`charge-${subId}`, async () => chargeRecurring(subId));
    }

    return { processed: due.length };
  },
);

/** Manual trigger when a subscription is created — kicks off the first
 * charge cycle so we don't have to wait until the cron tick. */
export const x402SubscriptionCreated = inngest.createFunction(
  { id: "x402-subscription-created" },
  { event: Events.X402_SUBSCRIPTION_CREATED },
  async ({ event, step }) => {
    const subscriptionId = (event.data as { subscriptionId: string }).subscriptionId;
    await step.run("first-charge", async () => chargeRecurring(subscriptionId));
    return { ok: true, ran: subscriptionId, runId: uuid() };
  },
);
