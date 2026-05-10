/**
 * Inngest client (singleton). Powers three durable workflows:
 *
 *   1. x402 recurring charges (lib/inngest/functions/x402-recurring.ts)
 *   2. cause-coin trade indexer (lib/inngest/functions/causecoin-indexer.ts)
 *   3. cause-coin graduation watcher (lib/inngest/functions/causecoin-graduation.ts)
 *
 * Plus event-driven jobs (CRM sync after x402 receipt, audit-log fanout).
 *
 * Local dev: run `npx inngest-cli@latest dev` in a separate terminal — it
 * auto-discovers functions at /api/inngest. Production: set
 * INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY env vars.
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "kali-v0",
  name: "Kali — Agentic Context Layer",
});

// Centralized event names so producers + consumers stay in sync.
export const Events = {
  X402_RECEIPT_ISSUED: "x402/receipt.issued",
  X402_RECURRING_DUE: "x402/recurring.due",
  X402_SUBSCRIPTION_CREATED: "x402/subscription.created",
  CRM_SYNC_BLOOMERANG: "crm/sync.bloomerang",
  CRM_SYNC_SALESFORCE: "crm/sync.salesforce",
  CAUSECOIN_DEPLOYED: "causecoin/deployed",
  CAUSECOIN_TRADE_DETECTED: "causecoin/trade.detected",
  CAUSECOIN_GRADUATION_REACHED: "causecoin/graduation.reached",
  CAUSECOIN_PROPOSAL_PASSED: "causecoin/proposal.passed",
} as const;

export type KaliEvent = (typeof Events)[keyof typeof Events];
