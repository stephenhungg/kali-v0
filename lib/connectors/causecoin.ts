/**
 * Cause-coin connector — exposes agent tools for launching, observing, and
 * trading per-tenant Solana tokens deployed via Meteora's Dynamic Bonding
 * Curve. The headline tool is `causecoin.crossReferenceHoldersWithDonors` —
 * the wow query that ties chain holders back to existing CRM records.
 *
 * Spec: data/cause-coins-spec.md (entire doc; particularly §4 connector,
 * §5 demo, and §6 risks).
 */

import { z } from "zod";
import type { Connector, ToolDefinition } from "./base";
import { registerConnector } from "./registry";
import {
  launchInput,
  launchOutput,
  marketStatsInput,
  marketStatsOutput,
  holdersInput,
  holdersOutput,
  recentTradesInput,
  recentTradesOutput,
  cumulativeFeesInput,
  cumulativeFeesOutput,
  simulateBuyInput,
  simulateBuyOutput,
  executeBuyInput,
  executeBuyOutput,
  proposalInput,
  proposalOutput,
  governanceSnapshotInput,
  governanceSnapshotOutput,
  crossReferenceInput,
  crossReferenceOutput,
} from "./causecoin.schema";
import { hashParams } from "./test-helpers";
import { resolveTenant } from "@/lib/tenants";
import { launchCauseCoin } from "@/lib/causecoin/deploy";
import {
  curveStateFor,
  cumulativeFees,
  executeBuy,
  listHolders,
  listTrades,
  loadCoin,
  loadCoinByTenant,
  loadCoinBySymbol,
  simulateBuy,
  tradesIn,
} from "@/lib/causecoin/trading";
import {
  castVote,
  createProposal,
  listProposals,
  tallyVotes,
} from "@/lib/causecoin/governance";
import { getBloomerangSeed } from "./bloomerang";
import { getSalesforceSeed } from "./salesforce";
import { walletForKaliEntityId, kaliEntityIdForWallet, registerWalletLink } from "@/lib/causecoin/wallet-links";

const CONNECTOR_ID = "causecoin" as const;

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

function explorerFor(addr: string, kind: "tx" | "address" = "tx"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

/* ─── audit wrapper ──────────────────────────────────────────────────── */

interface ToolSpec<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  name: string;
  description: string;
  domain: ToolDefinition["domain"];
  input: I;
  output: O;
  run: (input: z.infer<I>, ctx: { tenantId: string }) => Promise<z.infer<O>>;
  collectRecordIds?: (out: z.infer<O>) => string[];
}

function makeTool<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  spec: ToolSpec<I, O>,
): ToolDefinition<I, O> {
  return {
    name: spec.name,
    description: spec.description,
    domain: spec.domain,
    input: spec.input,
    output: spec.output,
    handler: async (input, ctx) => {
      const t0 = Date.now();
      const result = await spec.run(input, { tenantId: ctx.tenantId });
      await ctx.audit({
        source: CONNECTOR_ID,
        toolName: spec.name,
        paramsHash: hashParams(input),
        recordIds: spec.collectRecordIds ? spec.collectRecordIds(result) : [],
        durationMs: Date.now() - t0,
      });
      return result;
    },
  };
}

/* ─── helpers ────────────────────────────────────────────────────────── */

function resolveCoin(
  args: { coinId?: string; symbol?: string },
  tenantId: string,
): import("@/lib/db/memory").MemCauseCoin {
  if (args.coinId) {
    const c = loadCoin(args.coinId);
    if (c) return c;
  }
  if (args.symbol) {
    const c = loadCoinBySymbol(args.symbol);
    if (c) return c;
  }
  const c = loadCoinByTenant(tenantId);
  if (!c) {
    throw new Error(
      `no cause coin found — pass coinId/symbol explicitly or launch one first via causecoin.launch`,
    );
  }
  return c;
}

/* ─── tools ──────────────────────────────────────────────────────────── */

const tools: ToolDefinition[] = [
  makeTool({
    name: "causecoin.launch",
    description:
      "ADMIN-ONLY. Deploy a new SPL token + Meteora Dynamic Bonding Curve pool for the active tenant. Sets 1% trading fee routing 100% to treasury (with optional split to a community-directed fund). 24h cooling-off recommended before mainnet — defaults to devnet. Returns mint address, bonding curve pool, and Solana Explorer URLs.",
    domain: "payouts",
    input: launchInput,
    output: launchOutput,
    collectRecordIds: (out) => [out.coin.id, out.coin.mint, out.coin.bondingCurvePool],
    run: async (input) => {
      const tenant = await resolveTenant(input.tenantSlug);
      if (!tenant) throw new Error(`tenant ${input.tenantSlug} not found`);
      const result = await launchCauseCoin(tenant, {
        symbol: input.symbol,
        name: input.name,
        initialMarketCapUsd: input.initialMarketCapUsd,
        feeBps: input.feeBps,
        communityFundBps: input.communityFundBps,
        graduationThresholdUsd: input.graduationThresholdUsd,
        cause: input.cause,
      });
      return {
        coin: serializeCoin(result.coin),
        explorerUrls: result.explorerUrls,
        message: result.message,
      };
    },
  }),

  makeTool({
    name: "causecoin.getMarketStats",
    description:
      "Live market stats for a cause coin: price, market cap, FDV, 24h + window volume, holder count, cumulative fees routed to treasury + community fund, and graduation progress %. Defaults to the active tenant's coin if no symbol provided.",
    domain: "analytics",
    input: marketStatsInput,
    output: marketStatsOutput,
    collectRecordIds: (out) => [out.coin.id, out.coin.mint],
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const { config, progression } = curveStateFor(coin);
      const price = config.initialPriceUsdc + config.slope * progression;
      const marketCap = price * config.totalSupply;
      const fees = cumulativeFees(coin.id);
      const since24h = Date.now() - 86_400_000;
      const sinceWindow = Date.now() - input.windowDays * 86_400_000;
      const day = tradesIn(coin.id, since24h);
      const win = tradesIn(coin.id, sinceWindow);
      const holders = listHolders(coin.id);
      return {
        coin: serializeCoin(coin),
        priceUsdc: price,
        marketCapUsd: marketCap,
        fdvUsd: price * config.totalSupply,
        volume24hUsd: day.reduce((s, t) => s + t.usdcAmount, 0),
        volumeWindowUsd: win.reduce((s, t) => s + t.usdcAmount, 0),
        trades24h: day.length,
        tradesWindow: win.length,
        holderCount: holders.length,
        cumulativeFeesToTreasuryUsd: fees.treasury,
        cumulativeFeesToCommunityFundUsd: fees.communityFund,
        graduationProgressPct: Math.min(
          100,
          (marketCap / coin.graduationThresholdUsd) * 100,
        ),
      };
    },
  }),

  makeTool({
    name: "causecoin.getHolders",
    description:
      "Top N holders of a cause coin with balances, % of supply, cumulative USD they've contributed via trading fees, and first-acquired timestamp. Use when staff ask 'who owns the coin' or 'how concentrated is the cap table'.",
    domain: "analytics",
    input: holdersInput,
    output: holdersOutput,
    collectRecordIds: (out) => out.holders.map((h) => h.wallet),
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const all = listHolders(coin.id);
      const top = all.slice(0, input.top);
      const totalSupplyHeld = all.reduce((s, h) => s + h.balance, 0);
      const top5 = all.slice(0, 5).reduce((s, h) => s + h.balance, 0);
      const concentration = totalSupplyHeld > 0 ? (top5 / totalSupplyHeld) * 100 : 0;
      return {
        count: all.length,
        totalSupplyHeld,
        topConcentrationPct: concentration,
        holders: top.map((h) => ({
          wallet: h.wallet,
          balance: h.balance,
          pctOfSupply: totalSupplyHeld > 0 ? (h.balance / totalSupplyHeld) * 100 : 0,
          cumulativeContributedUsd: h.cumulativeContributedUsd,
          firstAcquiredAt: h.firstAcquiredAt,
          lastTradeAt: h.lastTradeAt,
        })),
      };
    },
  }),

  makeTool({
    name: "causecoin.getRecentTrades",
    description:
      "Last N trades of a cause coin with side (buy/sell), USDC amount, tokens, fees, and Solana Explorer URLs. Sorted newest first.",
    domain: "payouts",
    input: recentTradesInput,
    output: recentTradesOutput,
    collectRecordIds: (out) => out.trades.map((t) => t.txSignature),
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const trades = listTrades(coin.id, input.limit).map((t) => ({
        ...t,
        explorerUrl: explorerFor(t.txSignature, "tx"),
      }));
      return { count: trades.length, trades };
    },
  }),

  makeTool({
    name: "causecoin.getCumulativeFeesToTreasury",
    description:
      "Total USDC routed to the nonprofit's treasury via cause-coin trading fees since launch. Also splits out fees routed to the holder-governed community fund. The 'passive recurring revenue' headline number for nonprofit boards.",
    domain: "finance",
    input: cumulativeFeesInput,
    output: cumulativeFeesOutput,
    collectRecordIds: () => [],
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const fees = cumulativeFees(coin.id);
      return {
        coinId: coin.id,
        treasuryFeesUsdc: fees.treasury,
        communityFundFeesUsdc: fees.communityFund,
        totalFeesUsdc: fees.total,
        tradeCount: fees.tradeCount,
        sinceLaunch: coin.launchedAt,
      };
    },
  }),

  makeTool({
    name: "causecoin.simulateBuy",
    description:
      "Pre-trade quote for buying a cause coin. Returns tokens-out, price impact, fee breakdown (treasury vs community fund split), and slippage %. No state mutation. Use this to preview before execute.",
    domain: "analytics",
    input: simulateBuyInput,
    output: simulateBuyOutput,
    collectRecordIds: () => [],
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const q = simulateBuy(coin, input.usdcAmount);
      return {
        tokensOut: q.tokensOut,
        priceBefore: q.priceBefore,
        priceAfter: q.priceAfter,
        feeUsdc: q.feeUsdc,
        treasuryFeeUsdc: q.treasuryFeeUsdc,
        communityFundFeeUsdc: q.communityFundFeeUsdc,
        slippagePct: q.slippagePct,
      };
    },
  }),

  makeTool({
    name: "causecoin.executeBuyOnBehalfOfUser",
    description:
      "Execute a cause-coin buy on behalf of a user with a Privy delegated session. Settles via the bonding curve (or AMM post-graduation), writes a real trade row, updates holder balance + cumulative-contribution counter. Returns the tx signature, explorer URL, tokens received, fee breakdown, and new price. Mode is 'live' on devnet/mainnet when KALI_SOLANA_DEVNET_SECRET_KEY is configured, else 'simulated'.",
    domain: "payouts",
    input: executeBuyInput,
    output: executeBuyOutput,
    collectRecordIds: (out) => [out.txSignature],
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const result = await executeBuy({
        coin,
        buyerWallet: input.payerWallet,
        usdcAmount: input.usdcAmount,
      });
      // Bind wallet → user for future cross-reference matching.
      registerWalletLink({
        wallet: input.payerWallet,
        kali_entity_id: input.payerUserId,
        coinId: coin.id,
        boundAt: new Date().toISOString(),
      });
      return {
        txSignature: result.txSignature,
        explorerUrl: result.explorerUrl,
        tokensReceived: result.trade.tokenAmount,
        feeUsdc: result.trade.feeUsdc,
        priceAfter: result.trade.priceAfter,
        mode: result.mode,
        reason: result.reason,
      };
    },
  }),

  makeTool({
    name: "causecoin.proposeAllocation",
    description:
      "Create a holder-governance proposal to disburse USDC from the community fund to a recipient. Snapshots holder balances at the moment of creation. Voting opens immediately and closes at voteEnd (ISO datetime). Default quorum: 30% participation. Pass criterion: for-votes > against-votes.",
    domain: "payouts",
    input: proposalInput,
    output: proposalOutput,
    collectRecordIds: (out) => [out.proposalId],
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const proposal = await createProposal({
        coinId: coin.id,
        title: input.title,
        description: input.description,
        recipientWallet: input.recipientWallet,
        amountUsdc: input.amountUsdc,
        voteEnd: new Date(input.voteEnd),
      });
      return {
        proposalId: proposal.id,
        snapshotBlock: proposal.snapshotBlock,
        voteEnd: proposal.voteEnd,
        status: "open",
      };
    },
  }),

  makeTool({
    name: "causecoin.getGovernanceSnapshot",
    description:
      "List all governance proposals for a cause coin with current vote tallies (for / against / abstain), participation %, and status. Use when staff or holders ask 'what's being voted on'.",
    domain: "analytics",
    input: governanceSnapshotInput,
    output: governanceSnapshotOutput,
    collectRecordIds: (out) => out.proposals.map((p) => p.id),
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const proposals = await listProposals(coin.id);
      const detailed = await Promise.all(
        proposals.map(async (p) => {
          const tally = await tallyVotes(p.id);
          return {
            id: p.id,
            title: p.title,
            description: p.description,
            recipientWallet: p.recipientWallet,
            amountUsdc: p.amountUsdc,
            voteStart: p.voteStart,
            voteEnd: p.voteEnd,
            status: p.status,
            forVotes: tally.forVotes,
            againstVotes: tally.againstVotes,
            abstainVotes: tally.abstainVotes,
            participationPct: tally.participationPct,
          };
        }),
      );
      return { proposals: detailed };
    },
  }),

  makeTool({
    name: "causecoin.crossReferenceHoldersWithDonors",
    description:
      "**The wow query.** For the top N coin holders, look up each wallet's bound kali_entity_id and join against Bloomerang donors + Salesforce contacts. Returns existing major donors / board members who also bought the coin, plus a count of net-new wallets (awareness reach). The output is what the agent uses to answer 'cross-reference $RVRT holders with our donor base'.",
    domain: "donor",
    input: crossReferenceInput,
    output: crossReferenceOutput,
    collectRecordIds: (out) =>
      out.matched.map((m) => m.kali_entity_id),
    run: async (input, ctx) => {
      const coin = resolveCoin(input, ctx.tenantId);
      const holders = listHolders(coin.id, input.topN);
      const totalSupplyHeld = listHolders(coin.id).reduce(
        (s, h) => s + h.balance,
        0,
      );
      const bloomerang = await getBloomerangSeed();
      const salesforce = await getSalesforceSeed();
      const donorByEntity = new Map(
        bloomerang.constituents.map((c) => [c.kali_entity_id, c] as const),
      );
      const sfContactByEntity = new Map(
        (salesforce as { contacts?: Array<{ kali_entity_id: string; isBoard?: boolean; id: string }> }).contacts?.map(
          (c) => [c.kali_entity_id, c] as const,
        ) ?? [],
      );

      const matched: z.infer<typeof crossReferenceOutput>["matched"] = [];
      let unmatched = 0;

      for (const h of holders) {
        const entityId = kaliEntityIdForWallet(h.wallet);
        if (!entityId) {
          unmatched += 1;
          continue;
        }
        const constituent = donorByEntity.get(entityId);
        const sfContact = sfContactByEntity.get(entityId);
        const isBoard = Boolean(sfContact?.isBoard);
        if (!constituent && !sfContact) {
          unmatched += 1;
          continue;
        }
        matched.push({
          wallet: h.wallet,
          kali_entity_id: entityId,
          name: constituent
            ? `${constituent.firstName} ${constituent.lastName}`
            : null,
          bloomerangDonorId: constituent?.constituentId ?? null,
          salesforceContactId: sfContact?.id ?? null,
          lifetimeGivingUsd: constituent?.lifetimeGiving ?? null,
          isBoard,
          pctOfSupply: totalSupplyHeld > 0 ? (h.balance / totalSupplyHeld) * 100 : 0,
        });
      }

      const insights: string[] = [];
      const majorDonors = matched.filter(
        (m) => (m.lifetimeGivingUsd ?? 0) >= 5000,
      ).length;
      const boardMembers = matched.filter((m) => m.isBoard).length;
      if (matched.length > 0) {
        insights.push(
          `${matched.length} of the top ${holders.length} holders are existing CRM contacts.`,
        );
      }
      if (majorDonors > 0) {
        insights.push(
          `${majorDonors} are major donors (≥ $5K lifetime giving).`,
        );
      }
      if (boardMembers > 0) {
        insights.push(
          `${boardMembers} are current or former board members.`,
        );
      }
      if (unmatched > matched.length) {
        insights.push(
          `${unmatched} holders are net-new wallets — awareness reach beyond your existing donor base.`,
        );
      }

      return {
        totalHolders: listHolders(coin.id).length,
        examined: holders.length,
        matched,
        unmatchedCount: unmatched,
        insights,
      };
    },
  }),
];

function serializeCoin(c: import("@/lib/db/memory").MemCauseCoin) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    mint: c.mint,
    symbol: c.symbol,
    name: c.name,
    decimals: c.decimals,
    bondingCurvePool: c.bondingCurvePool,
    treasuryWallet: c.treasuryWallet,
    communityFundWallet: c.communityFundWallet,
    platformReserveWallet: c.platformReserveWallet,
    feeBps: c.feeBps,
    communityFundBps: c.communityFundBps,
    graduationThresholdUsd: c.graduationThresholdUsd,
    graduationStatus: c.graduationStatus,
    ammPool: c.ammPool ?? null,
    lpLockStreamflowId: c.lpLockStreamflowId ?? null,
    metadata: c.metadata as Record<string, string>,
    network: c.network,
    launchedAt: c.launchedAt,
    launchTxSig: c.launchTxSig ?? null,
  };
}

void walletForKaliEntityId;

import { loadAllSeeds } from "@/lib/causecoin/seed";

export const causecoinConnector: Connector = {
  id: CONNECTOR_ID,
  label: "Cause Coins",
  domain: "payouts",
  tools,
  init: async () => {
    await loadAllSeeds();
  },
};

let registered = false;
export function ensureRegistered(): void {
  if (registered) return;
  registerConnector(causecoinConnector);
  registered = true;
}

ensureRegistered();
