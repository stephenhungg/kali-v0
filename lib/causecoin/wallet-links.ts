/**
 * Wallet ↔ kali_entity_id binding registry.
 *
 * The "wow query" (causecoin.crossReferenceHoldersWithDonors) needs to map
 * coin holder wallets back to canonical Kali entities. Two paths populate
 * the registry:
 *
 *   1. Live: when a user buys via the Privy-embedded wallet flow we know
 *      both their wallet pubkey AND their kali_user_id, so we register the
 *      link automatically.
 *
 *   2. Seed: scripts/generate-causecoin-seed.ts writes pre-bound links for
 *      the demo so the cspec line "14 holders are existing Bloomerang
 *      donors" matches the actual seed.
 *
 * This is the in-memory fast path; production swaps to the `entity_links`
 * Drizzle table where `source_type='causecoin_wallet'`.
 */

export interface WalletLink {
  wallet: string;
  kali_entity_id: string;
  coinId: string;
  boundAt: string;
  /** Optional: how we learned about this binding. */
  source?: "privy_signin" | "first_donation" | "seed" | "manual";
}

const __byWallet = new Map<string, WalletLink>();
const __byEntity = new Map<string, string[]>();

export function registerWalletLink(link: WalletLink): void {
  __byWallet.set(link.wallet, link);
  const list = __byEntity.get(link.kali_entity_id) ?? [];
  if (!list.includes(link.wallet)) list.push(link.wallet);
  __byEntity.set(link.kali_entity_id, list);
}

export function kaliEntityIdForWallet(wallet: string): string | null {
  return __byWallet.get(wallet)?.kali_entity_id ?? null;
}

export function walletForKaliEntityId(kali_entity_id: string): string[] {
  return __byEntity.get(kali_entity_id) ?? [];
}

export function listAllWalletLinks(): WalletLink[] {
  return Array.from(__byWallet.values());
}

export function __resetWalletLinksForTest(): void {
  __byWallet.clear();
  __byEntity.clear();
}
