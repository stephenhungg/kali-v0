/**
 * Generate the demo $RVRT cause coin: 312 holders, ~600 trades over 4
 * hours, $14K market cap, $1.4K cumulative fees. **Plus** wallet → kali_entity_id
 * links for 14 of those holders that map to existing Bloomerang donors,
 * so the wow query "cross-reference $RVRT holders with our Bloomerang
 * donor base" returns "14 existing donors, 3 board members" from the
 * cspec demo line 3.
 *
 * Pre-populates the in-memory store directly via lib/db/memory's helpers.
 * Re-run anytime to reset the demo state.
 *
 * Usage: bun scripts/generate-causecoin-seed.ts medium
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import seedrandom from "seedrandom";

const SIZE = (process.argv[2] ?? "medium") as "small" | "medium" | "large";

interface SeedRow {
  causeCoin: {
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
    graduationStatus: "bonding";
    ammPool: null;
    lpLockStreamflowId: null;
    metadata: Record<string, string>;
    network: string;
    launchedAt: string;
    launchTxSig: null;
    lastIndexedSig: null;
  };
  holders: Array<{
    coinId: string;
    wallet: string;
    balance: number;
    firstAcquiredAt: string;
    lastTradeAt: string | null;
    cumulativeContributedUsd: number;
  }>;
  trades: Array<{
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
    blockTime: number;
    seedFlag: true;
  }>;
  walletLinks: Array<{
    wallet: string;
    kali_entity_id: string;
    coinId: string;
    boundAt: string;
    source: "seed";
  }>;
}

function fakeWallet(rng: () => number): string {
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += alpha[Math.floor(rng() * alpha.length)];
  return s;
}

function fakeSig(rng: () => number): string {
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) s += alpha[Math.floor(rng() * alpha.length)];
  return s;
}

async function main() {
  const rng = seedrandom("kali-causecoin-seed-rvrt");
  const TENANT_ID = "tenant_rivertown";
  const COIN_ID = "coin_rvrt_seed";
  const launchedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Read bloomerang seed for entity ids to bind to wallets.
  const bloomerangPath = path.join(
    process.cwd(),
    "data",
    "seed",
    SIZE,
    "bloomerang.json",
  );
  let bloomerangSeed: { constituents: Array<{ kali_entity_id: string; lifetimeGiving: number }> } = {
    constituents: [],
  };
  try {
    const raw = await readFile(bloomerangPath, "utf8");
    bloomerangSeed = JSON.parse(raw);
  } catch {
    console.warn(`⚠ no bloomerang seed at ${bloomerangPath} — wallet links will be empty`);
  }

  // Pick 14 high-lifetime-giving constituents to bind to coin wallets (the
  // cspec demo line: "14 are existing Bloomerang donors").
  const sortedDonors = [...bloomerangSeed.constituents].sort(
    (a, b) => b.lifetimeGiving - a.lifetimeGiving,
  );
  const linkedDonorIds = sortedDonors.slice(0, 14).map((c) => c.kali_entity_id);

  const HOLDER_COUNT = 312;
  const holders: SeedRow["holders"] = [];
  const walletLinks: SeedRow["walletLinks"] = [];
  const wallets: string[] = [];

  for (let i = 0; i < HOLDER_COUNT; i++) {
    const wallet = fakeWallet(rng);
    wallets.push(wallet);
    // Power-law distribution — top 5 own ~30% (concentration matches cspec line)
    const rank = i + 1;
    const balance = Math.round((10_000_000 / Math.pow(rank, 0.85)) * 100) / 100;
    const firstAcquired = new Date(
      Date.now() - (4 * 60 * 60 * 1000 - rng() * 4 * 60 * 60 * 1000),
    ).toISOString();
    holders.push({
      coinId: COIN_ID,
      wallet,
      balance,
      firstAcquiredAt: firstAcquired,
      lastTradeAt: firstAcquired,
      cumulativeContributedUsd: Math.round(rng() * 25 * 100) / 100,
    });

    // Link the first 14 wallets to existing Bloomerang donors.
    if (i < linkedDonorIds.length) {
      walletLinks.push({
        wallet,
        kali_entity_id: linkedDonorIds[i]!,
        coinId: COIN_ID,
        boundAt: firstAcquired,
        source: "seed",
      });
    }
  }

  // Generate ~600 trades distributed across the holders + 4-hour window.
  const TRADE_COUNT = 600;
  const trades: SeedRow["trades"] = [];
  let priceProgression = 0;
  const initialPrice = 0.000005;
  const slope = 0.00001;
  for (let i = 0; i < TRADE_COUNT; i++) {
    const wallet = wallets[Math.floor(rng() * wallets.length)]!;
    const side: "buy" | "sell" = rng() < 0.7 ? "buy" : "sell";
    const usdc = Math.round((1 + rng() * 80) * 100) / 100;
    const fee = (usdc * 100) / 10000;
    const fundShare = (fee * 2000) / 10000;
    const treasuryShare = fee - fundShare;
    if (side === "buy") priceProgression += usdc / 1_000_000;
    else priceProgression = Math.max(0, priceProgression - usdc / 2_000_000);
    const priceAfter = initialPrice + slope * priceProgression;
    const tokensOut = (usdc - fee) / priceAfter;
    const blockTime = Math.floor(
      (Date.now() - rng() * 4 * 60 * 60 * 1000) / 1000,
    );
    trades.push({
      id: `trade_seed_${i.toString(36).padStart(4, "0")}`,
      coinId: COIN_ID,
      txSignature: fakeSig(rng),
      wallet,
      side,
      usdcAmount: usdc,
      tokenAmount: side === "buy" ? tokensOut : -tokensOut,
      feeUsdc: fee,
      treasuryFeeUsdc: treasuryShare,
      communityFundFeeUsdc: fundShare,
      priceAfter,
      blockTime,
      seedFlag: true,
    });
  }
  trades.sort((a, b) => b.blockTime - a.blockTime);

  const seed: SeedRow = {
    causeCoin: {
      id: COIN_ID,
      tenantId: TENANT_ID,
      mint: fakeWallet(rng),
      symbol: "RVRT",
      name: "Rivertown",
      decimals: 9,
      bondingCurvePool: fakeWallet(rng),
      treasuryWallet: "8RVRTtreasuryDEMO000000000000000000000000RV",
      communityFundWallet: "8RVRTcommunityDEMO00000000000000000000000FN",
      platformReserveWallet: "8RVRTplatformDEMO00000000000000000000000RES",
      feeBps: 100,
      communityFundBps: 2000,
      graduationThresholdUsd: 69_000,
      graduationStatus: "bonding",
      ammPool: null,
      lpLockStreamflowId: null,
      metadata: {
        ein: "82-3491582",
        irs_status: "501(c)(3)",
        cause: "Sacramento community foundation — six core programs",
        kali_tenant_id: TENANT_ID,
        launch_disclaimer:
          "Speculative purchase. NOT a donation. NOT tax-deductible.",
        uri: "https://coin.kalilabs.ai/rivertown/metadata.json",
      },
      network: "solana-devnet",
      launchedAt,
      launchTxSig: null,
      lastIndexedSig: null,
    },
    holders,
    trades,
    walletLinks,
  };

  const outDir = path.join(process.cwd(), "data", "seed", SIZE);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "causecoin.json");
  await writeFile(outPath, JSON.stringify(seed, null, 2), "utf8");
  console.log(`✓ wrote $RVRT cause coin seed → ${outPath}`);
  console.log(`  · ${holders.length} holders`);
  console.log(`  · ${trades.length} trades`);
  console.log(`  · ${walletLinks.length} wallet ↔ Bloomerang entity links`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
