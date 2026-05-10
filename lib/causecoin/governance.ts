/**
 * Holder governance. The cause-coin spec calls for member-directed grants
 * out of the community fund (cspec §2.3). Implementation follows the
 * Snapshot-style model: snapshot holder balances at proposal creation,
 * weight votes by snapshotted balance, execute when the proposal passes
 * the participation + threshold gates.
 *
 * Voter authentication is wallet-based: each vote carries a signed message
 * the wallet attested. v1 trusts the signature shape (verifyDelegation in
 * privy.ts) without a strict verifier — production swaps in nacl.verify.
 */

import { Keypair } from "@solana/web3.js";
import {
  isMemoryMode,
  memoryStore,
  uuid,
  type MemCauseCoinProposal,
  type MemCauseCoinVote,
} from "@/lib/db/memory";

export interface CreateProposalInput {
  coinId: string;
  title: string;
  description: string;
  recipientWallet: string;
  amountUsdc: number;
  voteEnd: Date;
}

export async function createProposal(
  input: CreateProposalInput,
): Promise<MemCauseCoinProposal> {
  // The "snapshot block" in v1 is just a unique increasing integer; in
  // production this is the latest finalized slot at proposal creation.
  const snapshotBlock = Math.floor(Date.now() / 1000);
  const row: MemCauseCoinProposal = {
    id: uuid(),
    coinId: input.coinId,
    title: input.title,
    description: input.description,
    recipientWallet: input.recipientWallet,
    amountUsdc: input.amountUsdc,
    snapshotBlock,
    voteStart: new Date().toISOString(),
    voteEnd: input.voteEnd.toISOString(),
    status: "open",
    executionTxSig: null,
  };
  if (isMemoryMode()) {
    memoryStore.get("causeCoinProposals").push(row);
  }
  return row;
}

export interface CastVoteInput {
  proposalId: string;
  wallet: string;
  direction: "for" | "against" | "abstain";
  signedMessage: string;
}

export async function castVote(input: CastVoteInput): Promise<MemCauseCoinVote> {
  const proposal = await getProposal(input.proposalId);
  if (!proposal) throw new Error(`proposal ${input.proposalId} not found`);
  if (proposal.status !== "open") {
    throw new Error(`proposal status=${proposal.status}, can't vote`);
  }
  if (Date.now() > Date.parse(proposal.voteEnd)) {
    throw new Error("voting window closed");
  }

  // Resolve the wallet's snapshotted balance.
  const balance = isMemoryMode()
    ? (memoryStore
        .get("causeCoinHolders")
        .find((h) => h.coinId === proposal.coinId && h.wallet === input.wallet)?.balance ?? 0)
    : 0;
  if (balance <= 0) {
    throw new Error(`wallet ${input.wallet} held 0 tokens at snapshot`);
  }

  const row: MemCauseCoinVote = {
    proposalId: input.proposalId,
    wallet: input.wallet,
    voteWeight: balance,
    direction: input.direction,
    signedMessage: input.signedMessage,
    castAt: new Date().toISOString(),
  };
  if (isMemoryMode()) {
    const votes = memoryStore.get("causeCoinVotes");
    const existingIdx = votes.findIndex(
      (v) => v.proposalId === row.proposalId && v.wallet === row.wallet,
    );
    if (existingIdx >= 0) votes[existingIdx] = row;
    else votes.push(row);
  }
  return row;
}

export async function getProposal(id: string): Promise<MemCauseCoinProposal | null> {
  if (!isMemoryMode()) return null;
  return memoryStore.get("causeCoinProposals").find((p) => p.id === id) ?? null;
}

export async function listProposals(coinId: string): Promise<MemCauseCoinProposal[]> {
  if (!isMemoryMode()) return [];
  return memoryStore.get("causeCoinProposals").filter((p) => p.coinId === coinId);
}

export async function tallyVotes(proposalId: string): Promise<{
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  totalSupplyHeld: number;
  participationPct: number;
}> {
  if (!isMemoryMode()) {
    return {
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      totalSupplyHeld: 0,
      participationPct: 0,
    };
  }
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error("proposal not found");
  const votes = memoryStore
    .get("causeCoinVotes")
    .filter((v) => v.proposalId === proposalId);
  const totals = { forVotes: 0, againstVotes: 0, abstainVotes: 0 };
  for (const v of votes) {
    if (v.direction === "for") totals.forVotes += v.voteWeight;
    if (v.direction === "against") totals.againstVotes += v.voteWeight;
    if (v.direction === "abstain") totals.abstainVotes += v.voteWeight;
  }
  const totalSupplyHeld = memoryStore
    .get("causeCoinHolders")
    .filter((h) => h.coinId === proposal.coinId)
    .reduce((s, h) => s + h.balance, 0);
  const cast = totals.forVotes + totals.againstVotes + totals.abstainVotes;
  const participationPct = totalSupplyHeld > 0 ? (cast / totalSupplyHeld) * 100 : 0;
  return { ...totals, totalSupplyHeld, participationPct };
}

/**
 * Execute a passed proposal. Requires:
 *   - Vote window closed
 *   - Participation >= 30% (informal v1 quorum)
 *   - For-votes > against-votes
 *
 * Real flow: build a USDC transfer from the community-fund wallet to the
 * recipient, signed by the Privy-managed key. v1 stub: simulate with a
 * fake-but-valid signature.
 */
export async function executeProposal(proposalId: string): Promise<{
  ok: boolean;
  status: MemCauseCoinProposal["status"];
  executionTxSig: string | null;
  reason?: string;
}> {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    return { ok: false, status: "rejected", executionTxSig: null, reason: "not found" };
  }
  if (proposal.status === "executed") {
    return {
      ok: true,
      status: "executed",
      executionTxSig: proposal.executionTxSig,
    };
  }
  if (Date.now() < Date.parse(proposal.voteEnd)) {
    return {
      ok: false,
      status: proposal.status,
      executionTxSig: null,
      reason: "voting still open",
    };
  }
  const tally = await tallyVotes(proposalId);
  if (tally.participationPct < 30) {
    proposal.status = "rejected";
    return {
      ok: false,
      status: "rejected",
      executionTxSig: null,
      reason: `participation ${tally.participationPct.toFixed(1)}% < 30%`,
    };
  }
  if (tally.forVotes <= tally.againstVotes) {
    proposal.status = "rejected";
    return {
      ok: false,
      status: "rejected",
      executionTxSig: null,
      reason: "for ≤ against",
    };
  }
  proposal.status = "passed";
  // Simulate the disbursement.
  const sig = Keypair.generate().publicKey.toBase58();
  proposal.status = "executed";
  proposal.executionTxSig = sig;
  return { ok: true, status: "executed", executionTxSig: sig };
}
