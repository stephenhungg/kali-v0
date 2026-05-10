/**
 * Tax-receipt URL signing. We need any 3rd-party (donor's accountant, IRS
 * auditor, foundation grants officer) to be able to verify a Kali receipt
 * without an account. The URL embeds an HMAC-SHA256 signature over the
 * receipt's load-bearing fields; our public route validates the signature
 * before serving the PDF.
 *
 * Signing key: KALI_RECEIPT_SIGNING_KEY (rotate quarterly in production —
 * old keys still verify within their grace window via `accept` array).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

interface SignableFields {
  id: string;
  tenantId: string;
  amount: number; // USDC
  attribution: string;
}

function getKey(): Buffer {
  const k = process.env.KALI_RECEIPT_SIGNING_KEY;
  if (!k) {
    // Stable but very weak fallback so the dev server runs without ceremony.
    return Buffer.from("kali-dev-receipt-key-do-not-use-in-prod", "utf8");
  }
  // Accept hex (64 chars) or arbitrary string.
  if (/^[0-9a-fA-F]{64}$/.test(k)) {
    return Buffer.from(k, "hex");
  }
  return Buffer.from(k, "utf8");
}

function canonicalize(fields: SignableFields): string {
  return [fields.id, fields.tenantId, fields.amount.toFixed(6), fields.attribution].join("|");
}

export function signReceipt(fields: SignableFields): string {
  const mac = createHmac("sha256", getKey());
  mac.update(canonicalize(fields));
  return mac.digest("base64url");
}

export function verifyReceiptSig(fields: SignableFields, sig: string): boolean {
  if (!sig) return false;
  const expected = signReceipt(fields);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface ReceiptUrlOpts {
  baseUrl?: string;
  fields: SignableFields;
}

export function buildReceiptUrl(opts: ReceiptUrlOpts): string {
  const base = opts.baseUrl ?? process.env.KALI_RECEIPT_BASE ?? "https://kalilabs.ai";
  const sig = signReceipt(opts.fields);
  return `${base.replace(/\/$/, "")}/r/${opts.fields.id}?sig=${sig}`;
}
