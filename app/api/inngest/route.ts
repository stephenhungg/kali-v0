/**
 * Inngest function registry. Every durable workflow imported here gets
 * served at /api/inngest. The Inngest dev server (or cloud) discovers
 * them automatically on the next handshake.
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { x402RecurringCharges } from "@/lib/inngest/functions/x402-recurring";
import { causeCoinIndexer } from "@/lib/inngest/functions/causecoin-indexer";
import { causeCoinGraduationWatcher } from "@/lib/inngest/functions/causecoin-graduation";
import { x402CrmSync } from "@/lib/inngest/functions/x402-crm-sync";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    x402RecurringCharges,
    causeCoinIndexer,
    causeCoinGraduationWatcher,
    x402CrmSync,
  ],
});
