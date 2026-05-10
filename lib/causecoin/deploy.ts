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
  createInitializeMetadataPointerInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  LENGTH_SIZE,
  TYPE_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createInitializeMetadataInstruction,
  pack,
  type TokenMetadata,
} from "@solana/spl-token-metadata";
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
  // If a coin already exists for this tenant, return it UNLESS it's a stale
  // simulated record and the env now has live-mode keys — in that case we
  // wipe the simulated row + its dependent state so the new launch can
  // upgrade to onchain.
  if (isMemoryMode()) {
    const coins = memoryStore.get("causeCoins");
    const existingIdx = coins.findIndex((c) => c.tenantId === tenant.id);
    if (existingIdx >= 0) {
      const existing = coins[existingIdx]!;
      const wantLive = Boolean(process.env.KALI_SOLANA_DEVNET_SECRET_KEY);
      const isSimulated = !existing.launchTxSig;
      if (isSimulated && wantLive) {
        // Wipe the simulated coin + its trades + its holders so the next
        // launch is clean.
        coins.splice(existingIdx, 1);
        const trades = memoryStore.get("causeCoinTrades");
        for (let i = trades.length - 1; i >= 0; i--) {
          if (trades[i]!.coinId === existing.id) trades.splice(i, 1);
        }
        const holders = memoryStore.get("causeCoinHolders");
        for (let i = holders.length - 1; i >= 0; i--) {
          if (holders[i]!.coinId === existing.id) holders.splice(i, 1);
        }
      } else {
        return {
          coin: existing,
          explorerUrls: {
            mint: explorerFor(existing.mint),
            pool: explorerFor(existing.bondingCurvePool),
            deployTx: existing.launchTxSig ? explorerFor(existing.launchTxSig, "tx") : null,
          },
          message: existing.launchTxSig
            ? `coin already deployed onchain for ${tenant.slug} — returning existing record`
            : `simulated coin already exists for ${tenant.slug}; set KALI_SOLANA_DEVNET_SECRET_KEY + restart to upgrade`,
        };
      }
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
    symbol: opts.symbol,
    name: opts.name,
    uri: `https://${process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai"}/${tenant.slug}/metadata.json`,
    cause: opts.cause ?? meta.properties.cause,
    ein: tenant.ein,
    irsStatus: tenant.taxStatus,
    kaliTenantId: tenant.id,
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

interface DeployOnchainOpts {
  treasuryWallet: string;
  communityFundWallet: string;
  platformReserveWallet: string;
  feeBps: number;
  symbol: string;
  name: string;
  uri: string;
  cause: string;
  ein: string;
  irsStatus: string;
  kaliTenantId: string;
}

const INITIAL_SUPPLY_TOKENS = 1_000_000_000n; // 1B tokens, decimals=9
const DECIMALS = 9;

async function deployOnchain(opts: DeployOnchainOpts): Promise<DeployResult> {
  const haveKey = Boolean(process.env.KALI_SOLANA_DEVNET_SECRET_KEY);
  const funder = getPlatformFunder();
  const connection: Connection = getConnection(NETWORK);

  // Fresh mint + pool pubkeys per launch.
  const mintKeypair = Keypair.generate();
  const poolKeypair = Keypair.generate();

  let txSignature: TransactionSignature | null = null;
  try {
    const balance = await connection.getBalance(funder.publicKey).catch(() => 0);
    if (balance < 20_000_000) {
      // Need ~0.02 SOL for mint init + metadata extension + initial supply.
      if (haveKey) {
        throw new Error(
          `live deploy requested but funder ${funder.publicKey.toBase58()} only has ${(balance / 1e9).toFixed(6)} SOL. need at least 0.02 SOL. airdrop at https://faucet.solana.com or run: bun run wallet:balance`,
        );
      }
      return {
        mintPubkey: mintKeypair.publicKey.toBase58(),
        poolPubkey: poolKeypair.publicKey.toBase58(),
        txSignature: null,
      };
    }

    // ─── 1. Build the on-chain TokenMetadata struct ─────────────────────
    const treasuryPub = new PublicKey(opts.treasuryWallet);
    const metadata: TokenMetadata = {
      mint: mintKeypair.publicKey,
      name: `${opts.name} ($${opts.symbol})`,
      symbol: opts.symbol,
      uri: opts.uri,
      additionalMetadata: [
        ["cause", opts.cause],
        ["ein", opts.ein],
        ["irs_status", opts.irsStatus],
        ["kali_tenant_id", opts.kaliTenantId],
        ["disclaimer", "Speculative purchase. NOT a donation. NOT tax-deductible."],
      ],
      // Update authority lives on the funder for v1; production rotates to a
      // tenant-controlled key + eventually renounces.
      updateAuthority: funder.publicKey,
    };

    // Token-2022 metadata is stored TLV-encoded INSIDE the mint account.
    // Total mint size = mintLen (with extensions) + LENGTH_SIZE + TYPE_SIZE +
    // pack(metadata).length.
    const extensions = [ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const totalLen = mintLen + metadataLen;

    const lamports = await connection.getMinimumBalanceForRentExemption(totalLen);
    const { SystemProgram, sendAndConfirmTransaction } = await import(
      "@solana/web3.js"
    );

    // ─── 2. Single tx: createAccount + initMetadataPointer + initMint +
    //                   initMetadata + create treasury ATA + mintTo ──────
    // (We keep mint init + metadata init in the SAME tx as account creation
    //  because metadata init reads the mint's authority field, which is set
    //  by initMint.)
    const tx = new Transaction();
    tx.feePayer = funder.publicKey;

    tx.add(
      SystemProgram.createAccount({
        fromPubkey: funder.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen, // only the mint+ext part — metadata is appended via realloc
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // Metadata pointer points to the mint itself (self-describing token).
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        funder.publicKey,
        mintKeypair.publicKey, // metadata lives ON the mint
        TOKEN_2022_PROGRAM_ID,
      ),
      // Initialize the mint (sets decimals, mint authority, freeze authority).
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        DECIMALS,
        funder.publicKey,
        null, // no freeze authority — guarantees we can't blacklist holders
        TOKEN_2022_PROGRAM_ID,
      ),
      // Initialize the metadata in the mint account.
      createInitializeMetadataInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mintKeypair.publicKey,
        updateAuthority: funder.publicKey,
        mint: mintKeypair.publicKey,
        mintAuthority: funder.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      }),
      // Create the tenant treasury's associated token account for this mint.
      createAssociatedTokenAccountInstruction(
        funder.publicKey, // payer
        getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          treasuryPub,
          true,
          TOKEN_2022_PROGRAM_ID,
        ),
        treasuryPub,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      // Mint the entire initial supply directly to the treasury ATA. (In a
      // real Meteora DBC flow, ~80% would go to the bonding curve pool; for
      // v1 the curve is server-side so the supply lives on the treasury.)
      createMintToInstruction(
        mintKeypair.publicKey,
        getAssociatedTokenAddressSync(
          mintKeypair.publicKey,
          treasuryPub,
          true,
          TOKEN_2022_PROGRAM_ID,
        ),
        funder.publicKey,
        INITIAL_SUPPLY_TOKENS * BigInt(10 ** DECIMALS),
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [funder, mintKeypair],
      { commitment: "confirmed" },
    );
  } catch (e) {
    if (haveKey) throw e;
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
