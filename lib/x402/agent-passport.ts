/**
 * Agent reputation passport. Tracks autonomous wallets across all tenants
 * so a "research-bot that pays $0.05 to a coalition of food banks" builds
 * a public giving track record. Drives:
 *
 *   - The "top philanthropic agents" leaderboard (positive incentives in
 *     the agent economy)
 *   - The autonomous-wallet attribution registry (so we don't keep
 *     classifying repeat agents as "unknown")
 *   - Public verifiable URLs at app/api/x402/agents/<wallet>/passport
 *
 * For v1 we keep it in-process. Production swaps to a `agent_passports`
 * table with append-only signed entries (each tenant-side issuance is a
 * cryptographic attestation).
 */

import { isMemoryMode, memoryStore } from "@/lib/db/memory";

export interface AgentPassportRecord {
  wallet: string;
  /** Deterministic id derived from the wallet pubkey. */
  passportId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalDonationsUsdc: number;
  donationCount: number;
  tenantsSupported: string[]; // unique kali_entity_ids
  causes: string[]; // labels pulled from program designations / metadata
  attestations: Array<{
    issuer: string;
    issuedAt: string;
    note?: string;
  }>;
}

const __byWallet = new Map<string, AgentPassportRecord>();

function passportIdFor(wallet: string): string {
  return `pass_${wallet.slice(0, 8).toLowerCase()}_${wallet.slice(-6).toLowerCase()}`;
}

export function recordAgentDonation(opts: {
  wallet: string;
  tenantId: string;
  amountUsdc: number;
  cause?: string;
}): AgentPassportRecord {
  let rec = __byWallet.get(opts.wallet);
  const now = new Date().toISOString();
  if (!rec) {
    rec = {
      wallet: opts.wallet,
      passportId: passportIdFor(opts.wallet),
      firstSeenAt: now,
      lastSeenAt: now,
      totalDonationsUsdc: 0,
      donationCount: 0,
      tenantsSupported: [],
      causes: [],
      attestations: [],
    };
    __byWallet.set(opts.wallet, rec);
  }
  rec.lastSeenAt = now;
  rec.totalDonationsUsdc += opts.amountUsdc;
  rec.donationCount += 1;
  if (!rec.tenantsSupported.includes(opts.tenantId)) {
    rec.tenantsSupported.push(opts.tenantId);
  }
  if (opts.cause && !rec.causes.includes(opts.cause)) {
    rec.causes.push(opts.cause);
  }
  return rec;
}

export function getPassport(wallet: string): AgentPassportRecord | null {
  return __byWallet.get(wallet) ?? null;
}

export function listTopPhilanthropicAgents(limit = 25): AgentPassportRecord[] {
  // Rebuild from receipts on every call (memory mode) so seed-flagged
  // donations are reflected without explicit registration.
  if (isMemoryMode()) {
    rebuildFromReceipts();
  }
  return Array.from(__byWallet.values())
    .sort((a, b) => b.totalDonationsUsdc - a.totalDonationsUsdc)
    .slice(0, limit);
}

function rebuildFromReceipts(): void {
  const receipts = memoryStore.get("receipts");
  __byWallet.clear();
  for (const r of receipts) {
    if (r.attribution !== "autonomous") continue;
    recordAgentDonation({
      wallet: r.payerWallet,
      tenantId: r.tenantId,
      amountUsdc: r.amountUsdc,
      cause: r.programDesignation ?? undefined,
    });
  }
}

export function attestPassport(
  wallet: string,
  attestation: { issuer: string; note?: string },
): AgentPassportRecord | null {
  const rec = __byWallet.get(wallet);
  if (!rec) return null;
  rec.attestations.push({
    issuer: attestation.issuer,
    issuedAt: new Date().toISOString(),
    note: attestation.note,
  });
  return rec;
}
