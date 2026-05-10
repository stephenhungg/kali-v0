/**
 * Privy server-wallet wrapper. One module that hides the difference between:
 *
 *   - **Privy mode** (production): per-tenant wallets created via Privy's
 *     server-auth API. Each tenant has its own treasury + community-fund +
 *     platform-reserve wallet. Privy holds the keys; we ask it to sign.
 *
 *   - **Local mode** (devnet, no Privy creds): generates a deterministic
 *     keypair per (tenantId, kind) seeded from `KALI_SOLANA_DEVNET_SECRET_KEY`
 *     so the demo runs end-to-end without external services. The platform
 *     funder wallet is the existing pre-funded `EMc4...iocS` keypair.
 *
 * Both modes share the same surface so callers don't have to branch.
 *
 * Power users:
 *   - `signAndSendTx(walletId, tx, connection)` — wraps either Privy's signing
 *     RPC or `@solana/web3.js`'s `sendAndConfirmTransaction`.
 *   - `createDelegatedSession(...)` — produces a signed Ed25519 attestation
 *     that the wallet has authorized scope X for user Y until expiry. Used
 *     by x402 attribution + executeBuyOnBehalfOfUser.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, type Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  isMemoryMode,
  memoryStore,
  uuid,
  type MemTenantWallet,
} from "@/lib/db/memory";

export type WalletKind = "treasury" | "community_fund" | "platform_reserve";
export type SolanaNetwork = "solana-devnet" | "solana-mainnet";

export interface TenantWalletRecord {
  id: string;
  tenantId: string;
  network: SolanaNetwork;
  pubkey: string;
  privyWalletId?: string | null;
  kind: WalletKind;
}

export interface DelegationProof {
  userId: string;
  walletPubkey: string;
  scope: string; // e.g. "donate" | "trade"
  expiresAt: number; // unix ms
  nonce: string;
  signature: string; // base58 ed25519 signature over canonical JSON
}

const PRIVY_BASE = "https://auth.privy.io";

function defaultNetwork(): SolanaNetwork {
  const v = process.env.KALI_X402_NETWORK;
  if (v === "solana-mainnet") return "solana-mainnet";
  return "solana-devnet";
}

function rpcUrl(network: SolanaNetwork): string {
  if (network === "solana-mainnet") {
    return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  }
  return process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
}

export function getConnection(network?: SolanaNetwork): Connection {
  return new Connection(rpcUrl(network ?? defaultNetwork()), "confirmed");
}

/* ─── deterministic local keypair derivation ─────────────────────────── */

function platformFunder(): Keypair | null {
  const raw = process.env.KALI_SOLANA_DEVNET_SECRET_KEY;
  if (!raw) return null;
  try {
    if (raw.trim().startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

/**
 * Derive a deterministic Ed25519 keypair for (tenant, kind, network) from a
 * stable secret. This means a given tenant's treasury wallet has the same
 * pubkey across runs without persisting anything — perfect for the demo.
 */
function deriveLocalKeypair(
  tenantId: string,
  kind: WalletKind,
  network: SolanaNetwork,
): Keypair {
  const secret =
    process.env.KALI_LOCAL_WALLET_SEED ??
    process.env.KALI_RECEIPT_SIGNING_KEY ??
    "kali-local-dev-seed";
  const h = createHmac("sha512", secret)
    .update(`${tenantId}::${kind}::${network}`)
    .digest();
  // First 32 bytes = ed25519 seed.
  return Keypair.fromSeed(h.subarray(0, 32));
}

/* ─── Privy HTTP shim (only loaded in Privy mode) ────────────────────── */

interface PrivyCreateWalletResponse {
  id: string;
  address: string;
  chain_type: string;
}

async function privyRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET required for Privy mode");
  }
  const auth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  const res = await fetch(`${PRIVY_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "privy-app-id": appId,
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`privy ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function privyConfigured(): boolean {
  return Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

/* ─── public API ─────────────────────────────────────────────────────── */

export async function getOrCreateWallet(
  tenantId: string,
  kind: WalletKind,
  network: SolanaNetwork = defaultNetwork(),
): Promise<TenantWalletRecord> {
  // Memory-mode path (default in dev).
  if (isMemoryMode()) {
    const wallets = memoryStore.get("tenantWallets");
    const existing = wallets.find(
      (w) => w.tenantId === tenantId && w.kind === kind && w.network === network,
    );
    if (existing) return toRecord(existing);

    let privyWalletId: string | null = null;
    let pubkey: string;
    if (privyConfigured()) {
      const created = await privyRequest<PrivyCreateWalletResponse>(
        "/v1/wallets",
        {
          method: "POST",
          body: JSON.stringify({ chain_type: "solana" }),
        },
      );
      privyWalletId = created.id;
      pubkey = created.address;
    } else {
      const kp = deriveLocalKeypair(tenantId, kind, network);
      pubkey = kp.publicKey.toBase58();
    }

    const row: MemTenantWallet = {
      id: uuid(),
      tenantId,
      network,
      pubkey,
      privyWalletId,
      kind,
      createdAt: new Date().toISOString(),
    };
    wallets.push(row);
    return toRecord(row);
  }

  // Postgres-backed path. Fall through to local-derive-only for now; the
  // production swap calls into lib/db/client.ts.
  const kp = deriveLocalKeypair(tenantId, kind, network);
  return {
    id: `db_${tenantId}_${kind}`,
    tenantId,
    network,
    pubkey: kp.publicKey.toBase58(),
    privyWalletId: null,
    kind,
  };
}

function toRecord(w: MemTenantWallet): TenantWalletRecord {
  return {
    id: w.id,
    tenantId: w.tenantId,
    network: w.network as SolanaNetwork,
    pubkey: w.pubkey,
    privyWalletId: w.privyWalletId,
    kind: w.kind,
  };
}

export async function getOrCreateTreasuryWallet(
  tenantId: string,
  network?: SolanaNetwork,
): Promise<TenantWalletRecord> {
  return getOrCreateWallet(tenantId, "treasury", network);
}

export async function getOrCreateCommunityFundWallet(
  tenantId: string,
  network?: SolanaNetwork,
): Promise<TenantWalletRecord> {
  return getOrCreateWallet(tenantId, "community_fund", network);
}

export async function getOrCreatePlatformReserveWallet(
  tenantId: string,
  network?: SolanaNetwork,
): Promise<TenantWalletRecord> {
  return getOrCreateWallet(tenantId, "platform_reserve", network);
}

/**
 * Resolve the local Keypair backing a wallet (only available when the
 * wallet was created in local mode — Privy-managed wallets sign remotely).
 */
export function localKeypairFor(
  tenantId: string,
  kind: WalletKind,
  network: SolanaNetwork = defaultNetwork(),
): Keypair {
  if (privyConfigured()) {
    throw new Error(
      "localKeypairFor() requires local mode — Privy-managed wallets sign via Privy's API",
    );
  }
  return deriveLocalKeypair(tenantId, kind, network);
}

export interface SignAndSendOptions {
  /** Required when the wallet was created in local mode. */
  signers?: Keypair[];
  network?: SolanaNetwork;
}

/**
 * Sign + send a transaction on behalf of a tenant wallet. In local mode the
 * caller passes the Keypair via `signers`; in Privy mode we POST the
 * transaction to Privy's signing endpoint. Either way, we wait for confirm
 * and return the signature.
 */
export async function signAndSendTx(
  wallet: TenantWalletRecord,
  tx: Transaction,
  opts: SignAndSendOptions = {},
): Promise<string> {
  const network = opts.network ?? wallet.network;
  const connection = getConnection(network);

  if (wallet.privyWalletId && privyConfigured()) {
    const serialized = tx.serializeMessage().toString("base64");
    const signed = await privyRequest<{ signature: string }>(
      `/v1/wallets/${wallet.privyWalletId}/rpc`,
      {
        method: "POST",
        body: JSON.stringify({
          method: "signAndSendTransaction",
          caip2: network === "solana-mainnet" ? "solana:mainnet" : "solana:devnet",
          params: { transaction: serialized },
        }),
      },
    );
    return signed.signature;
  }

  const signers = opts.signers ?? [
    deriveLocalKeypair(wallet.tenantId, wallet.kind, network),
  ];
  const { sendAndConfirmTransaction } = await import("@solana/web3.js");
  return sendAndConfirmTransaction(connection, tx, signers, {
    commitment: "confirmed",
  });
}

/* ─── delegation proofs (used by x402 attribution + on-behalf trades) ── */

export interface CreateDelegationOpts {
  userId: string;
  scope: string;
  expiresAt?: number; // unix ms — default 30 days
  walletPubkey: string; // the human's wallet (or the tenant's if delegated to Kali)
  /** signing keypair — pass user's keypair for human-attested proofs */
  signer: Keypair;
}

/**
 * Build a canonical Ed25519-signed proof attesting "user X authorizes wallet Y
 * to take scope Z until time T." Verifiable offline by anyone who knows the
 * wallet's public key. This is the cryptographic substrate that turns an
 * autonomous wallet's payment into a tax-deductible HUMAN donation.
 */
export function createDelegatedSession(opts: CreateDelegationOpts): DelegationProof {
  const expiresAt = opts.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000;
  const nonce = randomBytes(16).toString("hex");
  const canonical = JSON.stringify({
    userId: opts.userId,
    walletPubkey: opts.walletPubkey,
    scope: opts.scope,
    expiresAt,
    nonce,
  });
  const message = Buffer.from(canonical, "utf8");
  const sig = nacl.sign.detached(message, opts.signer.secretKey);
  return {
    userId: opts.userId,
    walletPubkey: opts.walletPubkey,
    scope: opts.scope,
    expiresAt,
    nonce,
    signature: bs58.encode(sig),
  };
}

export function verifyDelegation(
  proof: DelegationProof,
  pubkey: string,
  requiredScope: string,
): { ok: boolean; reason?: string } {
  if (proof.expiresAt < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (proof.scope !== requiredScope) {
    return { ok: false, reason: `scope mismatch (got ${proof.scope}, want ${requiredScope})` };
  }
  if (proof.walletPubkey !== pubkey) {
    return { ok: false, reason: "wallet mismatch" };
  }
  const canonical = JSON.stringify({
    userId: proof.userId,
    walletPubkey: proof.walletPubkey,
    scope: proof.scope,
    expiresAt: proof.expiresAt,
    nonce: proof.nonce,
  });
  try {
    const ok = nacl.sign.detached.verify(
      Buffer.from(canonical, "utf8"),
      bs58.decode(proof.signature),
      new PublicKey(pubkey).toBytes(),
    );
    return ok ? { ok: true } : { ok: false, reason: "bad signature" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "verify failed" };
  }
}

/* ─── platform funder (existing pre-funded wallet) ───────────────────── */

export function getPlatformFunder(): Keypair {
  const fromEnv = platformFunder();
  if (fromEnv) return fromEnv;
  // Stable fallback for tests/scripts when env isn't set — this won't be
  // funded, so anything that hits chain will fail at airdrop check.
  return deriveLocalKeypair("__platform__", "treasury", "solana-devnet");
}

/** Identifier-less hash used to deduplicate concurrent wallet-create calls. */
export function walletKey(tenantId: string, kind: WalletKind, network: SolanaNetwork): string {
  return createHash("sha256")
    .update(`${tenantId}::${kind}::${network}`)
    .digest("hex");
}
