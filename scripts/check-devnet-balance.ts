/**
 * Check the kali devnet wallet's balance + airdrop status. Reads the keypair
 * from KALI_SOLANA_DEVNET_SECRET_KEY (set by scripts/make-devnet-wallet.ts).
 *
 * Usage: bun scripts/check-devnet-balance.ts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function loadKp(): Keypair | null {
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

async function main() {
  const kp = loadKp();
  if (!kp) {
    console.error("KALI_SOLANA_DEVNET_SECRET_KEY not set or invalid.");
    console.error("run: bun scripts/make-devnet-wallet.ts");
    process.exit(1);
  }
  const conn = new Connection(RPC, "confirmed");
  const lamports = await conn.getBalance(kp.publicKey);
  const sol = lamports / LAMPORTS_PER_SOL;
  console.log("");
  console.log("  pubkey :", kp.publicKey.toBase58());
  console.log("  balance:", sol.toFixed(4), "SOL (devnet)");
  console.log(
    "  explorer:",
    `https://explorer.solana.com/address/${kp.publicKey.toBase58()}?cluster=devnet`,
  );
  console.log("");
  if (sol < 0.01) {
    console.log("  ⚠ no SOL yet — airdrop via:");
    console.log("    https://faucet.solana.com  (paste the pubkey above)");
    console.log("    or:  https://faucet.quicknode.com/solana/devnet");
    process.exit(0);
  }
  if (sol < 0.05) {
    console.log("  ⚠ thin balance — okay for ~10 mint operations, top up if you can.");
  } else {
    console.log("  ✓ ready to launch coins!");
    console.log("");
    console.log("  next: open  http://localhost:3000/crypto  →  hit launch");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
