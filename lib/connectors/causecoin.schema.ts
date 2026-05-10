/**
 * Zod schemas for the cause-coin connector. Mirrors data/cause-coins-spec.md
 * §2 (token launch) + §4 (trading) + §6 (governance).
 */

import { z } from "zod";

export const causeCoinSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  mint: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number().int().nonnegative(),
  bondingCurvePool: z.string(),
  treasuryWallet: z.string(),
  communityFundWallet: z.string(),
  platformReserveWallet: z.string(),
  feeBps: z.number().int().nonnegative(),
  communityFundBps: z.number().int().nonnegative(),
  graduationThresholdUsd: z.number(),
  graduationStatus: z.enum(["bonding", "graduating", "graduated"]),
  ammPool: z.string().nullable(),
  lpLockStreamflowId: z.string().nullable(),
  metadata: z.object({
    ein: z.string().optional(),
    irs_status: z.string().optional(),
    cause: z.string().optional(),
    launch_disclaimer: z.string().optional(),
    kali_tenant_id: z.string().optional(),
    uri: z.string().optional(),
  }),
  network: z.string(),
  launchedAt: z.string(),
  launchTxSig: z.string().nullable(),
});
export type CauseCoin = z.infer<typeof causeCoinSchema>;

export const causeCoinHolderSchema = z.object({
  coinId: z.string(),
  wallet: z.string(),
  balance: z.number(),
  firstAcquiredAt: z.string(),
  lastTradeAt: z.string().nullable(),
  cumulativeContributedUsd: z.number(),
});
export type CauseCoinHolder = z.infer<typeof causeCoinHolderSchema>;

export const causeCoinTradeSchema = z.object({
  id: z.string(),
  coinId: z.string(),
  txSignature: z.string(),
  wallet: z.string(),
  side: z.enum(["buy", "sell"]),
  usdcAmount: z.number(),
  tokenAmount: z.number(),
  feeUsdc: z.number(),
  treasuryFeeUsdc: z.number(),
  communityFundFeeUsdc: z.number(),
  priceAfter: z.number(),
  blockTime: z.number(),
  seedFlag: z.boolean(),
  explorerUrl: z.string(),
});
export type CauseCoinTrade = z.infer<typeof causeCoinTradeSchema>;

/* ─── tool input/output schemas ──────────────────────────────────────── */

export const launchInput = z.object({
  tenantSlug: z.string(),
  symbol: z.string().regex(/^[A-Z]{2,8}$/),
  name: z.string().min(1).max(64),
  initialMarketCapUsd: z.number().positive().default(5000),
  feeBps: z.number().int().min(0).max(500).default(100),
  communityFundBps: z.number().int().min(0).max(5000).default(2000),
  graduationThresholdUsd: z.number().positive().default(69000),
  cause: z.string().optional(),
});

export const launchOutput = z.object({
  coin: causeCoinSchema,
  explorerUrls: z.object({
    mint: z.string(),
    pool: z.string(),
    deployTx: z.string().nullable(),
  }),
  message: z.string(),
});

export const marketStatsInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  windowDays: z.number().int().positive().max(365).default(30),
});

export const marketStatsOutput = z.object({
  coin: causeCoinSchema,
  priceUsdc: z.number(),
  marketCapUsd: z.number(),
  fdvUsd: z.number(),
  volume24hUsd: z.number(),
  volumeWindowUsd: z.number(),
  trades24h: z.number().int().nonnegative(),
  tradesWindow: z.number().int().nonnegative(),
  holderCount: z.number().int().nonnegative(),
  cumulativeFeesToTreasuryUsd: z.number(),
  cumulativeFeesToCommunityFundUsd: z.number(),
  graduationProgressPct: z.number(),
});

export const holdersInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  top: z.number().int().positive().max(500).default(50),
});

export const holdersOutput = z.object({
  count: z.number().int().nonnegative(),
  totalSupplyHeld: z.number(),
  topConcentrationPct: z.number(),
  holders: z.array(
    z.object({
      wallet: z.string(),
      balance: z.number(),
      pctOfSupply: z.number(),
      cumulativeContributedUsd: z.number(),
      firstAcquiredAt: z.string(),
      lastTradeAt: z.string().nullable(),
    }),
  ),
});

export const recentTradesInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  limit: z.number().int().positive().max(500).default(50),
});

export const recentTradesOutput = z.object({
  count: z.number().int().nonnegative(),
  trades: z.array(causeCoinTradeSchema),
});

export const cumulativeFeesInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
});

export const cumulativeFeesOutput = z.object({
  coinId: z.string(),
  treasuryFeesUsdc: z.number(),
  communityFundFeesUsdc: z.number(),
  totalFeesUsdc: z.number(),
  tradeCount: z.number().int().nonnegative(),
  sinceLaunch: z.string(),
});

export const simulateBuyInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  usdcAmount: z.number().positive(),
});

export const simulateBuyOutput = z.object({
  tokensOut: z.number(),
  priceBefore: z.number(),
  priceAfter: z.number(),
  feeUsdc: z.number(),
  treasuryFeeUsdc: z.number(),
  communityFundFeeUsdc: z.number(),
  slippagePct: z.number(),
});

export const executeBuyInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  usdcAmount: z.number().positive(),
  payerUserId: z.string(),
  payerWallet: z.string(),
});

export const executeBuyOutput = z.object({
  txSignature: z.string(),
  explorerUrl: z.string(),
  tokensReceived: z.number(),
  feeUsdc: z.number(),
  priceAfter: z.number(),
  mode: z.enum(["live", "simulated"]),
  reason: z.string().optional(),
});

export const proposalInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(2_000).default(""),
  recipientWallet: z.string(),
  amountUsdc: z.number().positive(),
  voteEnd: z.string(), // ISO datetime
});

export const proposalOutput = z.object({
  proposalId: z.string(),
  snapshotBlock: z.number().int().nonnegative(),
  voteEnd: z.string(),
  status: z.enum(["open"]),
});

export const governanceSnapshotInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
});

export const governanceSnapshotOutput = z.object({
  proposals: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      recipientWallet: z.string(),
      amountUsdc: z.number(),
      voteStart: z.string(),
      voteEnd: z.string(),
      status: z.string(),
      forVotes: z.number(),
      againstVotes: z.number(),
      abstainVotes: z.number(),
      participationPct: z.number(),
    }),
  ),
});

export const crossReferenceInput = z.object({
  coinId: z.string().optional(),
  symbol: z.string().optional(),
  topN: z.number().int().positive().max(500).default(50),
});

export const crossReferenceOutput = z.object({
  totalHolders: z.number().int().nonnegative(),
  examined: z.number().int().nonnegative(),
  matched: z.array(
    z.object({
      wallet: z.string(),
      kali_entity_id: z.string(),
      name: z.string().nullable(),
      bloomerangDonorId: z.string().nullable(),
      salesforceContactId: z.string().nullable(),
      lifetimeGivingUsd: z.number().nullable(),
      isBoard: z.boolean(),
      pctOfSupply: z.number(),
    }),
  ),
  unmatchedCount: z.number().int().nonnegative(),
  insights: z.array(z.string()),
});
