/**
 * Recurring x402 engine. The spec calls for monthly + weekly subscriptions
 * but x402 v1 doesn't standardize this — we implement on top.
 *
 * Storage shape: `x402_subscriptions` rows record amount, period, next
 * charge time, payer's delegation proof, and status. The Inngest cron
 * (`x402-recurring-charges`) wakes hourly, finds rows due, and calls
 * `chargeRecurring(subId)` per row.
 *
 * Charge flow:
 *   1. Load subscription + verify delegation proof still valid.
 *   2. Build a USDC transfer tx from payer's wallet → tenant treasury.
 *   3. Sign with the delegated session (Privy) or local fallback.
 *   4. Settle via the tenant's facilitator.
 *   5. Issue a fresh receipt with subscription_id set.
 *   6. Advance next_charge_at by period; reset retry_count.
 *
 * Failure: increment retry_count; on >= 3 mark status=failed and emit a
 * webhook (out of scope for v1 — we just log).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  isMemoryMode,
  memoryStore,
  uuid,
  type MemX402Subscription,
} from "@/lib/db/memory";
import { verifyDelegation, getConnection, localKeypairFor } from "@/lib/wallets/privy";
import { issueReceipt } from "./receipt";
import { getFacilitator } from "./facilitator";

interface ChargeResult {
  ok: boolean;
  subscriptionId: string;
  receiptId?: string;
  reason?: string;
}

export async function chargeRecurring(subscriptionId: string): Promise<ChargeResult> {
  const sub = await getSubscription(subscriptionId);
  if (!sub) {
    return { ok: false, subscriptionId, reason: "subscription not found" };
  }
  if (sub.status !== "active") {
    return { ok: false, subscriptionId, reason: `status=${sub.status}` };
  }

  const verified = verifyDelegation(
    sub.delegationProof as Parameters<typeof verifyDelegation>[0],
    sub.payerWallet,
    "donate",
  );
  if (!verified.ok) {
    await markFailed(sub, `delegation invalid: ${verified.reason}`);
    return { ok: false, subscriptionId, reason: verified.reason };
  }

  const network =
    (process.env.KALI_X402_NETWORK as "solana-devnet" | "solana-mainnet") ??
    "solana-devnet";
  const usdcMint = network === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

  const payerPubkey = new PublicKey(sub.payerWallet);
  // Treasury wallet for this tenant — same derivation as Privy module.
  const treasuryPubkey = new PublicKey(
    localKeypairFor(sub.tenantId, "treasury", network).publicKey,
  );

  const payerAta = getAssociatedTokenAddressSync(new PublicKey(usdcMint), payerPubkey, true);
  const tenantAta = getAssociatedTokenAddressSync(new PublicKey(usdcMint), treasuryPubkey, true);

  const baseUnits = BigInt(Math.round(sub.amountUsdc * 1_000_000));

  const ix = createTransferInstruction(
    payerAta,
    tenantAta,
    payerPubkey,
    baseUnits,
    [],
    TOKEN_PROGRAM_ID,
  );

  const conn: Connection = getConnection(network);
  const { blockhash } = await conn.getLatestBlockhash("confirmed").catch(() => ({
    blockhash: "11111111111111111111111111111111",
  }));

  const tx = new Transaction();
  tx.feePayer = payerPubkey;
  tx.recentBlockhash = blockhash;
  tx.add(ix);

  if (sub.memo) {
    const memoIx = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(sub.memo, "utf8"),
    });
    tx.add(memoIx);
  }

  // The recurring engine signs with the payer's local-derived keypair when
  // Privy is not configured; in production we'd POST the unsigned tx to the
  // payer's Privy delegated session and wait for the signed version back.
  let signer: Keypair | null;
  try {
    signer = localKeypairFor(`recurring_payer_${sub.payerWallet}`, "treasury", network);
  } catch {
    signer = null;
  }

  if (!signer) {
    await markFailed(sub, "no signing path available — Privy mode requires session round-trip");
    return { ok: false, subscriptionId, reason: "no signer" };
  }

  // For the demo path, we trust the local-derived keypair maps to the
  // payer; in real Privy mode the signed tx comes back from the API.
  tx.sign(signer);

  const facilitator = getFacilitator();
  const settled = await facilitator.settle({ signedTx: tx, network });
  if (!settled.ok) {
    await markFailed(sub, settled.reason ?? "settle failed");
    return { ok: false, subscriptionId, reason: settled.reason };
  }

  const receipt = await issueReceipt({
    tenantId: sub.tenantId,
    tenantKaliEntityId: sub.tenantId,
    txSignature: settled.txSignature,
    network,
    amountUsdc: sub.amountUsdc,
    payerWallet: sub.payerWallet,
    attribution: "human", // delegation proof = human
    attributionProof: sub.delegationProof,
    taxDeductible: true,
    memo: sub.memo,
    programDesignation: sub.programDesignation,
    subscriptionId: sub.id,
  });

  await advance(sub, receipt.id);
  return { ok: true, subscriptionId, receiptId: receipt.id };
}

/* ─── store helpers ──────────────────────────────────────────────────── */

async function getSubscription(id: string): Promise<MemX402Subscription | null> {
  if (isMemoryMode()) {
    return memoryStore.get("subscriptions").find((s) => s.id === id) ?? null;
  }
  return null;
}

async function markFailed(sub: MemX402Subscription, reason: string): Promise<void> {
  sub.retryCount += 1;
  if (sub.retryCount >= 3) {
    sub.status = "failed";
  }
  // Stash reason on memo for now — production has a dedicated `last_error` col
  sub.memo = `${sub.memo ?? ""} [failed: ${reason}]`.slice(0, 240);
}

async function advance(sub: MemX402Subscription, receiptId: string): Promise<void> {
  sub.lastReceiptId = receiptId;
  sub.retryCount = 0;
  const now = new Date(sub.nextChargeAt);
  if (sub.period === "weekly") {
    now.setUTCDate(now.getUTCDate() + 7);
  } else {
    now.setUTCMonth(now.getUTCMonth() + 1);
  }
  sub.nextChargeAt = now.toISOString();
}

/* ─── public API ─────────────────────────────────────────────────────── */

export interface CreateSubscriptionInput {
  tenantId: string;
  payerWallet: string;
  amountUsdc: number;
  period: "weekly" | "monthly";
  delegationProof: Record<string, unknown>;
  startAt?: Date;
  endDate?: Date;
  memo?: string;
  programDesignation?: string;
}

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<MemX402Subscription> {
  const id = uuid();
  const now = (input.startAt ?? new Date()).toISOString();
  const row: MemX402Subscription = {
    id,
    tenantId: input.tenantId,
    payerWallet: input.payerWallet,
    amountUsdc: input.amountUsdc,
    period: input.period,
    nextChargeAt: now,
    endDate: input.endDate?.toISOString() ?? null,
    delegationProof: input.delegationProof,
    status: "active",
    retryCount: 0,
    lastReceiptId: null,
    memo: input.memo ?? null,
    programDesignation: input.programDesignation ?? null,
    createdAt: new Date().toISOString(),
  };
  if (isMemoryMode()) {
    memoryStore.get("subscriptions").push(row);
  }
  return row;
}

export async function cancelSubscription(
  id: string,
): Promise<{ ok: boolean; status: MemX402Subscription["status"] }> {
  const sub = await getSubscription(id);
  if (!sub) return { ok: false, status: "canceled" };
  sub.status = "canceled";
  return { ok: true, status: "canceled" };
}

export async function listSubscriptions(opts: {
  tenantId: string;
  status?: MemX402Subscription["status"];
}): Promise<MemX402Subscription[]> {
  if (!isMemoryMode()) return [];
  let rows = memoryStore
    .get("subscriptions")
    .filter((s) => s.tenantId === opts.tenantId);
  if (opts.status) rows = rows.filter((s) => s.status === opts.status);
  return rows;
}
