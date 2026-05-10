/**
 * Donation attribution classifier. Determines whether a payment was made
 * by a verified human (and therefore tax-deductible) or by an autonomous
 * agent (revenue, but not tax-deductible).
 *
 * Three classes:
 *   - "human"      — Privy delegation proof binds the payer wallet to a
 *                    verified user identity. Tax-deductible.
 *   - "autonomous" — Wallet matches a known agent passport in the registry.
 *                    Revenue, not tax-deductible.
 *   - "unknown"    — No proof and no registry hit. Default. Receipt issued
 *                    but `tax_deductible: false`.
 */

import { verifyDelegation, type DelegationProof } from "@/lib/wallets/privy";
import type { Attribution } from "@/lib/connectors/x402.schema";

export interface AttributionInput {
  payerWallet: string;
  metadata: {
    memo?: string;
    kali_user_id?: string;
    delegationProof?: DelegationProof;
    program_designation?: string;
  };
}

export interface AttributionResult {
  attribution: Attribution;
  taxDeductible: boolean;
  proof: Record<string, unknown> | null;
  /** When `attribution=autonomous`, this is the agent passport id we matched. */
  agentPassportId?: string;
  /** Why we classified as we did — useful for the audit log. */
  reason: string;
}

/**
 * Registry of known autonomous agent wallets. Real impl loads from the
 * `agent_passports` table (see lib/x402/agent-passport.ts in M7); for v1
 * we keep a small in-memory list seeded by the demo. A wallet is considered
 * autonomous if it has executed >= AUTONOMOUS_THRESHOLD x402 donations
 * across >= 2 tenants without ever providing a delegation proof.
 */
const knownAgentWallets = new Map<string, string>(); // wallet → passportId

export function registerAgentPassport(wallet: string, passportId: string): void {
  knownAgentWallets.set(wallet, passportId);
}

export function classifyAttribution(input: AttributionInput): AttributionResult {
  const proof = input.metadata.delegationProof;
  if (proof) {
    const verified = verifyDelegation(proof, input.payerWallet, "donate");
    if (verified.ok) {
      return {
        attribution: "human",
        taxDeductible: true,
        proof: {
          userId: proof.userId,
          walletPubkey: proof.walletPubkey,
          scope: proof.scope,
          expiresAt: proof.expiresAt,
          nonce: proof.nonce,
          signature: proof.signature,
        },
        reason: "valid Privy delegation proof for scope=donate",
      };
    }
    return {
      attribution: "unknown",
      taxDeductible: false,
      proof: null,
      reason: `delegation rejected: ${verified.reason}`,
    };
  }

  const agentId = knownAgentWallets.get(input.payerWallet);
  if (agentId) {
    return {
      attribution: "autonomous",
      taxDeductible: false,
      proof: { agentPassportId: agentId },
      agentPassportId: agentId,
      reason: `wallet ${input.payerWallet} is registered agent ${agentId}`,
    };
  }

  // No proof and not a registered agent — default to unknown.
  return {
    attribution: "unknown",
    taxDeductible: false,
    proof: null,
    reason: "no delegation proof and wallet not in agent passport registry",
  };
}

export function isAutonomousMemo(memo?: string): boolean {
  if (!memo) return false;
  const lower = memo.toLowerCase();
  return (
    lower.includes("agent") ||
    lower.includes("autonomous") ||
    lower.includes("research-bot")
  );
}
