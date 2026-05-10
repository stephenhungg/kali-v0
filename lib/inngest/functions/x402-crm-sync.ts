/**
 * CRM sync fanout. Triggered by `x402/receipt.issued` for every successful
 * receipt — emits soft-credit transactions in Bloomerang and Opportunity
 * records in Salesforce NPSP tagged Type=Agent Donation.
 *
 * For v1 the connectors are mocked, so this is a no-op stub that records
 * the sync attempt in the audit log. Real OAuth integration lands in M7.
 */

import { inngest, Events } from "../client";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";

export const x402CrmSync = inngest.createFunction(
  { id: "x402-crm-sync", name: "x402 receipt → CRM sync" },
  { event: Events.X402_RECEIPT_ISSUED },
  async ({ event, step }) => {
    const receiptId = (event.data as { receiptId: string }).receiptId;

    await step.run("mark-synced", async () => {
      if (isMemoryMode()) {
        const r = memoryStore.get("receipts").find((r) => r.id === receiptId);
        if (r) r.syncedToCrm = true;
      }
    });

    // Real impl: call Bloomerang and Salesforce APIs. For now, return shape
    // matches the wire so downstream consumers (audit log, dashboard) work.
    return {
      receiptId,
      bloomerang: { ok: true, mode: "mock" as const },
      salesforce: { ok: true, mode: "mock" as const },
    };
  },
);
