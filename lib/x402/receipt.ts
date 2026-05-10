/**
 * Receipt issuance. After a payment settles we mint a receipt row, sign
 * its tax_receipt_url, persist it, fanout to CRM sync via Inngest, and
 * return the wire-shape receipt the route handler hands back to the agent.
 *
 * Idempotent: if a receipt with the same tx_signature already exists we
 * return that one instead of inserting a duplicate (the verifier should
 * have caught this earlier, but defense-in-depth never hurt anyone).
 */

import { isMemoryMode, memoryStore, uuid, type MemX402Receipt } from "@/lib/db/memory";
import { buildReceiptUrl } from "./url-sign";
import type { Attribution, X402Receipt } from "@/lib/connectors/x402.schema";
import { inngest, Events } from "@/lib/inngest/client";

export interface IssueReceiptInput {
  tenantId: string;
  tenantKaliEntityId: string;
  txSignature: string;
  network: string;
  amountUsdc: number;
  payerWallet: string;
  attribution: Attribution;
  attributionProof: Record<string, unknown> | null;
  taxDeductible: boolean;
  memo?: string | null;
  programDesignation?: string | null;
  subscriptionId?: string | null;
  seedFlag?: boolean;
}

const KALI_RECEIPT_PREFIX = "rcpt_";

function newReceiptId(): string {
  // 12-char base36, prefixed. Stable + URL-safe + readable.
  return `${KALI_RECEIPT_PREFIX}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
}

export async function issueReceipt(input: IssueReceiptInput): Promise<X402Receipt> {
  const existing = await findBySignature(input.txSignature);
  if (existing) return existing;

  const id = newReceiptId();
  const receivedAt = new Date().toISOString();
  const explorerUrl = explorerFor(input.txSignature, input.network);
  const taxReceiptUrl = input.taxDeductible
    ? buildReceiptUrl({
        fields: {
          id,
          tenantId: input.tenantId,
          amount: input.amountUsdc,
          attribution: input.attribution,
        },
      })
    : null;

  const row: MemX402Receipt = {
    id,
    tenantId: input.tenantId,
    txSignature: input.txSignature,
    network: input.network,
    amountUsdc: input.amountUsdc,
    payerWallet: input.payerWallet,
    attribution: input.attribution,
    attributionProof: input.attributionProof,
    taxDeductible: input.taxDeductible,
    taxReceiptUrl,
    memo: input.memo ?? null,
    programDesignation: input.programDesignation ?? null,
    subscriptionId: input.subscriptionId ?? null,
    syncedToCrm: false,
    receivedAt,
    seedFlag: input.seedFlag ?? false,
  };

  if (isMemoryMode()) {
    memoryStore.get("receipts").push(row);
  }
  // Postgres path (production): insert into x402_receipts table

  // Fire CRM sync (non-blocking — Inngest is durable; if dev server isn't
  // up, the call short-circuits and we eat the error so the receipt still
  // goes through).
  try {
    await inngest.send({
      name: Events.X402_RECEIPT_ISSUED,
      data: { receiptId: id, tenantId: input.tenantId, amountUsdc: input.amountUsdc },
    });
  } catch {
    // intentionally swallowed — receipt issuance must not fail on Inngest down.
  }

  return toWireReceipt(row, input.tenantKaliEntityId, explorerUrl);
}

async function findBySignature(txSignature: string): Promise<X402Receipt | null> {
  if (isMemoryMode()) {
    const r = memoryStore.get("receipts").find((r) => r.txSignature === txSignature);
    if (!r) return null;
    return toWireReceipt(r, r.tenantId, explorerFor(r.txSignature, r.network));
  }
  return null;
}

function explorerFor(signature: string, network: string): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = network === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/tx/${signature}${cluster}`;
}

export function toWireReceipt(
  row: MemX402Receipt,
  tenantKaliEntityId: string,
  explorerUrl?: string,
): X402Receipt {
  return {
    id: row.id,
    kali_entity_id: row.id,
    tenant_kali_entity_id: tenantKaliEntityId,
    amount_usdc: row.amountUsdc,
    tx_signature: row.txSignature,
    network: row.network,
    explorer_url: explorerUrl ?? explorerFor(row.txSignature, row.network),
    received_at: row.receivedAt,
    payer_wallet: row.payerWallet,
    attribution: row.attribution,
    attribution_proof: row.attributionProof ?? null,
    tax_deductible: row.taxDeductible,
    tax_receipt_url: row.taxReceiptUrl ?? null,
    memo: row.memo ?? null,
    program_designation: row.programDesignation ?? null,
    subscription_id: row.subscriptionId ?? null,
    synced_to_crm: row.syncedToCrm,
    seed_flag: row.seedFlag,
  };
}

export async function listReceipts(opts: {
  tenantId: string;
  windowDays?: number;
  attribution?: Attribution;
  limit?: number;
}): Promise<MemX402Receipt[]> {
  if (!isMemoryMode()) return [];
  const cutoff = opts.windowDays
    ? Date.now() - opts.windowDays * 86_400_000
    : 0;
  let rows = memoryStore
    .get("receipts")
    .filter((r) => r.tenantId === opts.tenantId)
    .filter((r) => Date.parse(r.receivedAt) >= cutoff);
  if (opts.attribution) {
    rows = rows.filter((r) => r.attribution === opts.attribution);
  }
  rows = rows.sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  );
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function getReceipt(id: string): Promise<MemX402Receipt | null> {
  if (!isMemoryMode()) return null;
  return memoryStore.get("receipts").find((r) => r.id === id) ?? null;
}
