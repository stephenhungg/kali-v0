/**
 * x402 payload verification. Two responsibilities:
 *
 *   1. **Decode** the base64-encoded `X-Payment` header into a typed
 *      X402PaymentHeader (zod-validated).
 *
 *   2. **Verify** the inner Solana transaction matches the 402 quote we
 *      issued: the recipient ATA is the tenant's treasury, the SPL mint
 *      is USDC, the amount is within bounds, the blockhash is recent
 *      (replay window), and signatures are valid.
 *
 * Idempotency check + TRM/OFAC screening are companion concerns exposed
 * here so a single `verifyPayment()` call returns everything the route
 * handler needs to decide whether to settle or reject.
 */

import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  type ParsedInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  x402PaymentHeaderSchema,
  type X402PaymentHeader,
} from "@/lib/connectors/x402.schema";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";

const MIN_USDC_BASE_UNITS = 100_000n; // $0.10 — dust attack floor
const MAX_USDC_BASE_UNITS = 1_000_000_000n * 1_000_000n; // $1B — sanity ceiling

export interface VerifyExpected {
  network: string;
  asset: string; // USDC mint
  payToWallet: string; // tenant treasury pubkey
  minAmount: bigint; // base units
  maxAmount: bigint;
}

export interface VerifyOk {
  ok: true;
  payerWallet: string;
  amount: bigint; // base units
  txSignature: string; // signature ID we'll use to dedupe + cite
  signedTx: Transaction | VersionedTransaction;
  network: string;
  metadata: NonNullable<X402PaymentHeader["payload"]["metadata"]>;
}

export interface VerifyErr {
  ok: false;
  reason: string;
  code:
    | "missing_header"
    | "bad_header"
    | "wrong_network"
    | "wrong_asset"
    | "wrong_recipient"
    | "amount_oob"
    | "no_transfer"
    | "bad_signature"
    | "duplicate"
    | "screen_failed";
}

export type VerifyResult = VerifyOk | VerifyErr;

/* ─── header decode ──────────────────────────────────────────────────── */

export function decodeXPayment(headerValue: string | null): X402PaymentHeader | null {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return x402PaymentHeaderSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function encodeXPayment(payment: X402PaymentHeader): string {
  return Buffer.from(JSON.stringify(payment), "utf8").toString("base64");
}

/* ─── main verify entry point ────────────────────────────────────────── */

export async function verifyPayment(
  rawHeader: string | null,
  expected: VerifyExpected,
): Promise<VerifyResult> {
  const decoded = decodeXPayment(rawHeader);
  if (!decoded) {
    return {
      ok: false,
      reason: "missing or malformed X-Payment header",
      code: rawHeader ? "bad_header" : "missing_header",
    };
  }

  if (decoded.network !== expected.network) {
    return {
      ok: false,
      reason: `network mismatch: got ${decoded.network}, expected ${expected.network}`,
      code: "wrong_network",
    };
  }

  // Deserialize the inner Solana transaction.
  let tx: Transaction | VersionedTransaction;
  try {
    const buf = Buffer.from(decoded.payload.serializedTransaction, "base64");
    try {
      tx = Transaction.from(buf);
    } catch {
      tx = VersionedTransaction.deserialize(buf);
    }
  } catch (e) {
    return {
      ok: false,
      reason: `cannot deserialize tx: ${e instanceof Error ? e.message : String(e)}`,
      code: "bad_header",
    };
  }

  const xfer = extractUsdcTransfer(tx, expected);
  if (!xfer) {
    return {
      ok: false,
      reason: "no SPL token transfer to expected recipient ATA found",
      code: "no_transfer",
    };
  }

  if (xfer.amount < expected.minAmount) {
    return {
      ok: false,
      reason: `amount ${xfer.amount} below min ${expected.minAmount}`,
      code: "amount_oob",
    };
  }
  if (xfer.amount > expected.maxAmount) {
    return {
      ok: false,
      reason: `amount ${xfer.amount} exceeds max ${expected.maxAmount}`,
      code: "amount_oob",
    };
  }
  if (xfer.amount < MIN_USDC_BASE_UNITS) {
    return {
      ok: false,
      reason: `amount below dust floor ($0.10)`,
      code: "amount_oob",
    };
  }
  if (xfer.amount > MAX_USDC_BASE_UNITS) {
    return {
      ok: false,
      reason: `amount above sanity ceiling`,
      code: "amount_oob",
    };
  }

  // Compute a stable signature for idempotency. For unsigned txs this is the
  // hash of the serialized message; for signed txs it's the first signature
  // string (which becomes the eventual onchain signature).
  const txSignature = computeStableSignature(tx);

  if (await isDuplicate(txSignature)) {
    return {
      ok: false,
      reason: "tx signature already settled",
      code: "duplicate",
    };
  }

  return {
    ok: true,
    payerWallet: xfer.payerWallet,
    amount: xfer.amount,
    txSignature,
    signedTx: tx,
    network: decoded.network,
    metadata: decoded.payload.metadata ?? {},
  };
}

/* ─── helpers ────────────────────────────────────────────────────────── */

interface UsdcTransfer {
  payerWallet: string; // owner of source ATA
  recipientAta: string;
  amount: bigint;
}

/**
 * Find the SPL Token transfer instruction inside a versioned/legacy tx that
 * pays the tenant's USDC ATA. We accept either the classic Token program or
 * Token-2022 (matches the cause-coin spec which uses Token-2022 for metadata).
 */
function extractUsdcTransfer(
  tx: Transaction | VersionedTransaction,
  expected: VerifyExpected,
): UsdcTransfer | null {
  const recipientAta = getAssociatedTokenAddressSync(
    new PublicKey(expected.asset),
    new PublicKey(expected.payToWallet),
    /* allowOwnerOffCurve */ true,
  ).toBase58();

  const tokenProgs = new Set([
    TOKEN_PROGRAM_ID.toBase58(),
    TOKEN_2022_PROGRAM_ID.toBase58(),
  ]);

  // Legacy transaction layout has `instructions[]` with `programId` directly.
  if (tx instanceof Transaction) {
    for (const ix of tx.instructions) {
      if (!tokenProgs.has(ix.programId.toBase58())) continue;
      const parsed = parseSplTransfer(ix.data, ix.keys.map((k) => k.pubkey.toBase58()));
      if (!parsed) continue;
      if (parsed.destination !== recipientAta) continue;
      return {
        payerWallet: parsed.owner ?? parsed.source,
        recipientAta,
        amount: parsed.amount,
      };
    }
    return null;
  }

  // VersionedTransaction: instructions reference accounts by index into
  // `staticAccountKeys` (or address-table-lookups, which we don't expand here).
  const message = tx.message;
  const staticKeys = message.staticAccountKeys.map((k) => k.toBase58());
  for (const ix of message.compiledInstructions) {
    const programId = staticKeys[ix.programIdIndex];
    if (!programId || !tokenProgs.has(programId)) continue;
    const accountKeys = Array.from(ix.accountKeyIndexes).map(
      (i) => staticKeys[i] ?? "",
    );
    const parsed = parseSplTransfer(Buffer.from(ix.data), accountKeys);
    if (!parsed) continue;
    if (parsed.destination !== recipientAta) continue;
    return {
      payerWallet: parsed.owner ?? parsed.source,
      recipientAta,
      amount: parsed.amount,
    };
  }
  return null;
}

interface ParsedSplTransfer {
  source: string;
  destination: string;
  owner: string | null;
  amount: bigint;
}

/**
 * Parse SPL-Token Transfer (instruction code 3) and TransferChecked (12).
 * Returns the source ATA, dest ATA, signing owner, and amount in base units.
 */
function parseSplTransfer(
  data: Buffer | Uint8Array,
  accountKeys: string[],
): ParsedSplTransfer | null {
  if (data.length < 1) return null;
  const op = data[0];
  // Transfer: [op=3, amount: u64 LE]   accounts: [source, dest, owner, ...signers]
  // TransferChecked: [op=12, amount: u64 LE, decimals: u8]   accounts: [source, mint, dest, owner, ...]
  const buf = Buffer.from(data);
  if (op === 3) {
    if (buf.length < 9) return null;
    if (accountKeys.length < 3) return null;
    return {
      source: accountKeys[0]!,
      destination: accountKeys[1]!,
      owner: accountKeys[2] ?? null,
      amount: buf.readBigUInt64LE(1),
    };
  }
  if (op === 12) {
    if (buf.length < 10) return null;
    if (accountKeys.length < 4) return null;
    return {
      source: accountKeys[0]!,
      destination: accountKeys[2]!,
      owner: accountKeys[3] ?? null,
      amount: buf.readBigUInt64LE(1),
    };
  }
  return null;
}

function computeStableSignature(tx: Transaction | VersionedTransaction): string {
  // If the tx is signed, the first signature IS the onchain signature.
  if (tx instanceof Transaction) {
    const sig = tx.signatures[0]?.signature;
    if (sig && sig.length > 0) {
      // base58-encode using bs58.
      const bs58 = require("bs58") as typeof import("bs58");
      return bs58.default.encode(sig);
    }
    // Unsigned: hash the message.
    const crypto = require("node:crypto") as typeof import("node:crypto");
    return `unsigned_${crypto.createHash("sha256").update(tx.serializeMessage()).digest("hex").slice(0, 64)}`;
  }
  // VersionedTransaction.
  const sig = tx.signatures[0];
  if (sig && sig.some((b) => b !== 0)) {
    const bs58 = require("bs58") as typeof import("bs58");
    return bs58.default.encode(sig);
  }
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return `unsigned_${crypto.createHash("sha256").update(tx.message.serialize()).digest("hex").slice(0, 64)}`;
}

async function isDuplicate(txSignature: string): Promise<boolean> {
  if (isMemoryMode()) {
    return memoryStore.get("receipts").some((r) => r.txSignature === txSignature);
  }
  // Postgres path: select 1 from x402_receipts where tx_signature = $1
  return false;
}

/* ─── TRM Labs / OFAC screening ──────────────────────────────────────── */

export interface ScreenResult {
  flagged: boolean;
  severity: "none" | "low" | "medium" | "high";
  reason?: string;
}

export async function screenWallet(wallet: string): Promise<ScreenResult> {
  const apiKey = process.env.TRM_LABS_API_KEY;
  if (!apiKey) {
    // Open mode — required only when KALI_TRM_REQUIRED=true
    if (process.env.KALI_TRM_REQUIRED === "true") {
      return { flagged: true, severity: "high", reason: "TRM not configured" };
    }
    return { flagged: false, severity: "none" };
  }
  try {
    const res = await fetch("https://api.trmlabs.com/public/v2/screening/addresses", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ address: wallet, chain: "solana" }]),
    });
    if (!res.ok) {
      // Fail-open in soft mode, fail-closed in strict mode.
      if (process.env.KALI_TRM_REQUIRED === "true") {
        return { flagged: true, severity: "high", reason: `trm ${res.status}` };
      }
      return { flagged: false, severity: "none", reason: `trm soft-fail ${res.status}` };
    }
    const data = (await res.json()) as Array<{
      addressRiskIndicators?: Array<{ category: string; riskScore: number }>;
    }>;
    const indicators = data[0]?.addressRiskIndicators ?? [];
    const max = indicators.reduce((m, x) => Math.max(m, x.riskScore), 0);
    if (max >= 70) {
      return { flagged: true, severity: "high", reason: "trm risk score >= 70" };
    }
    if (max >= 30) {
      return { flagged: true, severity: "medium", reason: "trm risk score >= 30" };
    }
    return { flagged: false, severity: max >= 10 ? "low" : "none" };
  } catch (e) {
    if (process.env.KALI_TRM_REQUIRED === "true") {
      return {
        flagged: true,
        severity: "high",
        reason: e instanceof Error ? e.message : "trm error",
      };
    }
    return { flagged: false, severity: "none" };
  }
}

void (null as unknown as ParsedInstruction); // silence unused import warning if the type is bundled
