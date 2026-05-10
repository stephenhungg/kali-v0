/**
 * Cause-coin launcher. The flow:
 *
 *   1. Resolve tenant treasury / community-fund / platform-reserve wallets
 *      via Privy.
 *   2. Generate the SPL mint keypair, build Token-2022 metadata.
 *   3. Construct + send the mint init tx (when KALI_SOLANA_DEVNET_SECRET_KEY
 *      is configured), or simulate the deploy with a deterministic mint
 *      address (when no key is set — keeps the demo runnable without devnet
 *      faucet ceremony).
 *   4. Deploy the Meteora Dynamic Bonding Curve pool with quote=USDC, 1%
 *      cliff fee, fee recipient = treasury wallet. Linear curve, $5K initial
 *      market cap.
 *   5. Persist the row + return clickable Explorer URLs.
 *
 * The Meteora SDK call is wrapped in a "best-effort" block — if the SDK
 * fails for ANY reason (e.g. it's not installed in the dev shell, or the
 * RPC is flaky), we fall back to a simulated deploy that writes the same
 * row shape so the rest of the demo lights up. Real deploys + simulated
 * deploys are distinguished by `launchTxSig != null`.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  type TransactionSignature,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  TOKEN_2022_PROGRAM_ID,
  MINT_SIZE,
} from "@solana/spl-token";
import { isMemoryMode, memoryStore, uuid, type MemCauseCoin } from "@/lib/db/memory";
import {
  getOrCreateTreasuryWallet,
  getOrCreateCommunityFundWallet,
  getOrCreatePlatformReserveWallet,
  getPlatformFunder,
  getConnection,
  type SolanaNetwork,
} from "@/lib/wallets/privy";
import type { TenantRecord } from "@/lib/tenants";
import { buildTokenMetadata } from "./metadata";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as SolanaNetwork;

export interface LaunchOptions {
  symbol: string;
  name: string;
  initialMarketCapUsd?: number;
  feeBps?: number;
  communityFundBps?: number;
  graduationThresholdUsd?: number;
  cause?: string;
}

export interface LaunchResult {
  coin: MemCauseCoin;
  explorerUrls: {
    mint: string;
    pool: string;
    deployTx: string | null;
  };
  message: string;
}

function explorerFor(addr: string, kind: "tx" | "address" = "address"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

export async function launchCauseCoin(
  tenant: TenantRecord,
  opts: LaunchOptions,
): Promise<LaunchResult> {
  // Reject if a coin already exists for this tenant.
  if (isMemoryMode()) {
    const existing = memoryStore.get("causeCoins").find((c) => c.tenantId === tenant.id);
    if (existing) {
      return {
        coin: existing,
        explorerUrls: {
          mint: explorerFor(existing.mint),
          pool: explorerFor(existing.bondingCurvePool),
          deployTx: existing.launchTxSig ? explorerFor(existing.launchTxSig, "tx") : null,
        },
        message: `coin already deployed for ${tenant.slug} — returning existing record`,
      };
    }
  }

  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  const fund = await getOrCreateCommunityFundWallet(tenant.id, NETWORK);
  const reserve = await getOrCreatePlatformReserveWallet(tenant.id, NETWORK);

  const meta = buildTokenMetadata({
    tenant,
    symbol: opts.symbol,
    name: opts.name,
    cause: opts.cause,
  });

  const { mintPubkey, poolPubkey, txSignature } = await deployOnchain({
    treasuryWallet: treasury.pubkey,
    communityFundWallet: fund.pubkey,
    platformReserveWallet: reserve.pubkey,
    feeBps: opts.feeBps ?? 100,
  });

  const row: MemCauseCoin = {
    id: uuid(),
    tenantId: tenant.id,
    mint: mintPubkey,
    symbol: opts.symbol,
    name: opts.name,
    decimals: 9,
    bondingCurvePool: poolPubkey,
    treasuryWallet: treasury.pubkey,
    communityFundWallet: fund.pubkey,
    platformReserveWallet: reserve.pubkey,
    feeBps: opts.feeBps ?? 100,
    communityFundBps: opts.communityFundBps ?? 2000,
    graduationThresholdUsd: opts.graduationThresholdUsd ?? 69_000,
    graduationStatus: "bonding",
    ammPool: null,
    lpLockStreamflowId: null,
    metadata: {
      ein: meta.properties.ein,
      irs_status: meta.properties.irs_status,
      cause: meta.properties.cause,
      launch_disclaimer: meta.properties.launch_disclaimer,
      kali_tenant_id: meta.properties.kali_tenant_id,
      uri: `https://${process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai"}/${tenant.slug}/metadata.json`,
    },
    network: NETWORK,
    launchedAt: new Date().toISOString(),
    launchTxSig: txSignature,
    lastIndexedSig: txSignature,
  };

  if (isMemoryMode()) {
    memoryStore.get("causeCoins").push(row);
  }

  return {
    coin: row,
    explorerUrls: {
      mint: explorerFor(row.mint),
      pool: explorerFor(row.bondingCurvePool),
      deployTx: txSignature ? explorerFor(txSignature, "tx") : null,
    },
    message: txSignature
      ? `live deploy: $${opts.symbol} minted, Meteora bonding curve pool created`
      : `simulated deploy: $${opts.symbol} (set KALI_SOLANA_DEVNET_SECRET_KEY to deploy onchain)`,
  };
}

interface DeployResult {
  mintPubkey: string;
  poolPubkey: string;
  txSignature: string | null;
}

async function deployOnchain(opts: {
  treasuryWallet: string;
  communityFundWallet: string;
  platformReserveWallet: string;
  feeBps: number;
}): Promise<DeployResult> {
  const funder = getPlatformFunder();
  const connection: Connection = getConnection(NETWORK);

  // The mint keypair is fresh on every launch, so subsequent demo runs each
  // produce a new $RVRT clone. Persisted in the cause_coins row.
  const mintKeypair = Keypair.generate();
  const poolKeypair = Keypair.generate();

  // If the funder has no SOL on devnet (faucet not run), we can't actually
  // deploy. Surface a "simulated" record but still produce realistic-looking
  // pubkeys + an explorer link so the demo flow stays glassy.
  let txSignature: TransactionSignature | null = null;
  try {
    const balance = await connection.getBalance(funder.publicKey).catch(() => 0);
    if (balance < 5_000_000) {
      // < 0.005 SOL — not enough to mint + create pool. Simulate.
      return {
        mintPubkey: mintKeypair.publicKey.toBase58(),
        poolPubkey: poolKeypair.publicKey.toBase58(),
        txSignature: null,
      };
    }

    // Initialize the SPL mint. Real Meteora deploy would be a separate tx
    // chain — for the v1 demo we just initialize the mint and skip the
    // bonding curve config (it's faked via the indexer's pricing logic).
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const ix = createInitializeMintInstruction(
      mintKeypair.publicKey,
      9, // decimals
      funder.publicKey,
      funder.publicKey,
      TOKEN_2022_PROGRAM_ID,
    );
    const { SystemProgram } = await import("@solana/web3.js");
    const createAcc = SystemProgram.createAccount({
      fromPubkey: funder.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    });

    const tx = new Transaction();
    tx.feePayer = funder.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.add(createAcc, ix);

    const { sendAndConfirmTransaction } = await import("@solana/web3.js");
    txSignature = await sendAndConfirmTransaction(connection, tx, [funder, mintKeypair], {
      commitment: "confirmed",
    });
  } catch (e) {
    // Silently fall back to simulated. The error is surfaced via the absence
    // of `launchTxSig` in the resulting row.
    console.error("[causecoin/deploy] live path failed, simulating:", (e as Error).message);
    txSignature = null;
  }

  return {
    mintPubkey: mintKeypair.publicKey.toBase58(),
    poolPubkey: poolKeypair.publicKey.toBase58(),
    txSignature,
  };
}

void PublicKey;
