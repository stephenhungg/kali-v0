/**
 * In-memory store for the new x402 + cause-coin tables. Keeps the demo
 * runnable without a real Postgres — every script + connector below reads
 * from here when `DATABASE_URL` is unset (or `KALI_DB_MODE=memory`).
 *
 * Concurrency: not safe for multi-process use. Fine for the dev server +
 * Inngest dev worker which run in the same Node process.
 */

import { randomUUID } from "node:crypto";

export interface MemX402Receipt {
  id: string;
  tenantId: string;
  txSignature: string;
  network: string;
  amountUsdc: number;
  payerWallet: string;
  attribution: "human" | "autonomous" | "unknown";
  attributionProof?: Record<string, unknown> | null;
  taxDeductible: boolean;
  taxReceiptUrl?: string | null;
  memo?: string | null;
  programDesignation?: string | null;
  subscriptionId?: string | null;
  syncedToCrm: boolean;
  receivedAt: string; // ISO
  seedFlag: boolean;
}

export interface MemX402Subscription {
  id: string;
  tenantId: string;
  payerWallet: string;
  amountUsdc: number;
  period: "weekly" | "monthly";
  nextChargeAt: string;
  endDate?: string | null;
  delegationProof: Record<string, unknown>;
  status: "active" | "paused" | "canceled" | "failed";
  retryCount: number;
  lastReceiptId?: string | null;
  memo?: string | null;
  programDesignation?: string | null;
  createdAt: string;
}

export interface MemTenantWallet {
  id: string;
  tenantId: string;
  network: string;
  pubkey: string;
  privyWalletId?: string | null;
  kind: "treasury" | "community_fund" | "platform_reserve";
  createdAt: string;
}

export interface MemCauseCoin {
  id: string;
  tenantId: string;
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  bondingCurvePool: string;
  treasuryWallet: string;
  communityFundWallet: string;
  platformReserveWallet: string;
  feeBps: number;
  communityFundBps: number;
  graduationThresholdUsd: number;
  graduationStatus: "bonding" | "graduating" | "graduated";
  ammPool?: string | null;
  lpLockStreamflowId?: string | null;
  metadata: Record<string, unknown>;
  network: string;
  launchedAt: string;
  launchTxSig?: string | null;
  lastIndexedSig?: string | null;
}

export interface MemCauseCoinHolder {
  coinId: string;
  wallet: string;
  balance: number;
  firstAcquiredAt: string;
  lastTradeAt?: string | null;
  cumulativeContributedUsd: number;
}

export interface MemCauseCoinTrade {
  id: string;
  coinId: string;
  txSignature: string;
  wallet: string;
  side: "buy" | "sell";
  usdcAmount: number;
  tokenAmount: number;
  feeUsdc: number;
  treasuryFeeUsdc: number;
  communityFundFeeUsdc: number;
  priceAfter: number;
  blockTime: number; // unix seconds
  seedFlag: boolean;
}

export interface MemCauseCoinProposal {
  id: string;
  coinId: string;
  title: string;
  description: string;
  recipientWallet: string;
  amountUsdc: number;
  snapshotBlock: number;
  voteStart: string;
  voteEnd: string;
  status: "open" | "passed" | "rejected" | "executed";
  executionTxSig?: string | null;
}

export interface MemCauseCoinVote {
  proposalId: string;
  wallet: string;
  voteWeight: number;
  direction: "for" | "against" | "abstain";
  signedMessage: string;
  castAt: string;
}

interface Store {
  receipts: MemX402Receipt[];
  subscriptions: MemX402Subscription[];
  tenantWallets: MemTenantWallet[];
  causeCoins: MemCauseCoin[];
  causeCoinHolders: MemCauseCoinHolder[];
  causeCoinTrades: MemCauseCoinTrade[];
  causeCoinProposals: MemCauseCoinProposal[];
  causeCoinVotes: MemCauseCoinVote[];
}

const store: Store = {
  receipts: [],
  subscriptions: [],
  tenantWallets: [],
  causeCoins: [],
  causeCoinHolders: [],
  causeCoinTrades: [],
  causeCoinProposals: [],
  causeCoinVotes: [],
};

export const memoryStore = {
  get<K extends keyof Store>(key: K): Store[K] {
    return store[key];
  },
  reset(): void {
    store.receipts.length = 0;
    store.subscriptions.length = 0;
    store.tenantWallets.length = 0;
    store.causeCoins.length = 0;
    store.causeCoinHolders.length = 0;
    store.causeCoinTrades.length = 0;
    store.causeCoinProposals.length = 0;
    store.causeCoinVotes.length = 0;
  },
};

export function uuid(): string {
  return randomUUID();
}

export function isMemoryMode(): boolean {
  return !process.env.DATABASE_URL || process.env.KALI_DB_MODE === "memory";
}
