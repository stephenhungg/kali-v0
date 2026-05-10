/**
 * GET /api/dashboard/stats
 *
 * Real-data aggregate for the dashboard stat cards. Replaces the previous
 * hardcoded values (5575/2437/$1.2M/17) with counts pulled from the actual
 * connector seeds + memory store.
 *
 * Fields:
 *   - recordsIndexed   — sum of recordCount across all "connected" connectors
 *   - donations        — count + total of bloomerang transactions (lifetime)
 *   - cashOnHand       — quickbooks getCashPosition().totalCashOnHand
 *   - grantsInPipeline — instrumentl grants with status in {prospect, in_progress, submitted}
 *   - lastSyncAt       — newest lastSyncAt across the connector grid
 */

import { NextResponse } from "next/server";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack, listSyncStates } from "@/lib/connectors/sync-state";
import { getBloomerangSeed } from "@/lib/connectors/bloomerang";
import { getInstrumentlSeed } from "@/lib/connectors/instrumentl";
import { getQuickbooksSeed } from "@/lib/connectors/quickbooks";
import { getCashPosition } from "@/lib/connectors/quickbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await initAllAndTrack(
    listConnectors().map((c) => ({ id: c.id, label: c.label, init: c.init })),
  );

  const states = listSyncStates();
  const recordsIndexed = states.reduce(
    (s, e) => s + (e.recordCount ?? 0),
    0,
  );
  const lastSyncAt = states
    .map((e) => e.lastSyncAt)
    .filter((s): s is string => Boolean(s))
    .sort()
    .reverse()[0] ?? null;

  const bloomerang = await getBloomerangSeed();
  const donationsCount = bloomerang.transactions.length;
  const donationsTotal = bloomerang.transactions.reduce(
    (s, t) => s + t.amount,
    0,
  );

  const qb = await getQuickbooksSeed();
  const cashPos = getCashPosition(qb);

  const inst = await getInstrumentlSeed();
  const pipelineStatuses = new Set(["prospect", "in_progress", "submitted"]);
  const pipelineGrants = inst.grants.filter((g) =>
    pipelineStatuses.has(g.status),
  );
  const pipelineRequestedTotal = pipelineGrants.reduce(
    (s, g) => s + g.requestedAmount,
    0,
  );

  return NextResponse.json({
    recordsIndexed,
    connectorsConnected: states.filter((s) => s.status === "connected").length,
    donations: {
      count: donationsCount,
      totalUsd: donationsTotal,
    },
    cashOnHand: {
      totalUsd: cashPos.totalCashOnHand,
      bankAccountCount: cashPos.accounts.length,
    },
    grantsInPipeline: {
      count: pipelineGrants.length,
      requestedTotalUsd: pipelineRequestedTotal,
    },
    lastSyncAt,
  });
}
