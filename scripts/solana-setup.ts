/**
 * Solana devnet demo bootstrapper.
 *
 *   bun scripts/solana-setup.ts           # generate + airdrop + print env var
 *   bun scripts/solana-setup.ts balance   # report current devnet balance
 *   bun scripts/solana-setup.ts airdrop   # request another 2 SOL airdrop
 *
 * Generates (if missing) a Solana keypair, persists it to
 * `~/.config/kali/solana-devnet.json`, requests a devnet faucet airdrop
 * (2 SOL), and prints the base58-encoded secret key for the operator to
 * paste into their environment as `KALI_SOLANA_DEVNET_SECRET_KEY`.
 *
 * On demo day:
 *   bun scripts/solana-setup.ts
 *   export KALI_SOLANA_DEVNET_SECRET_KEY=<printed-value>
 *   bun run dev
 *
 * That's it — `solana.batchPayout` will now run real onchain on devnet.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const KEY_DIR = path.join(homedir(), ".config", "kali");
const KEY_PATH = path.join(KEY_DIR, "solana-devnet.json");
const RPC_URL =
  process.env.KALI_SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";

function loadOrCreateKeypair(): Keypair {
  if (existsSync(KEY_PATH)) {
    const arr = JSON.parse(readFileSync(KEY_PATH, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  mkdirSync(KEY_DIR, { recursive: true });
  const kp = Keypair.generate();
  writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)), {
    mode: 0o600,
  });
  return kp;
}

async function showBalance(conn: Connection, pk: PublicKey): Promise<number> {
  const lamports = await conn.getBalance(pk, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

async function airdrop(conn: Connection, pk: PublicKey, amountSol = 2): Promise<string> {
  console.log(`[solana-setup] requesting ${amountSol} SOL airdrop on devnet...`);
  const sig = await conn.requestAirdrop(pk, amountSol * LAMPORTS_PER_SOL);
  // confirm
  const latest = await conn.getLatestBlockhash("confirmed");
  await conn.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  return sig;
}

async function main() {
  const cmd = process.argv[2] ?? "init";
  const conn = new Connection(RPC_URL, "confirmed");
  const kp = loadOrCreateKeypair();

  console.log(`[solana-setup] keypair: ${kp.publicKey.toBase58()}`);
  console.log(`[solana-setup] secret keyfile: ${KEY_PATH}`);
  console.log(`[solana-setup] cluster RPC: ${RPC_URL}`);

  if (cmd === "balance") {
    const sol = await showBalance(conn, kp.publicKey);
    console.log(`[solana-setup] balance: ${sol} SOL`);
    return;
  }

  if (cmd === "airdrop" || cmd === "init") {
    try {
      const sig = await airdrop(conn, kp.publicKey, 2);
      console.log(
        `[solana-setup] airdrop confirmed: https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[solana-setup] airdrop failed (${msg}). Devnet faucet rate-limits — try the web faucet at https://faucet.solana.com/`,
      );
    }
  }

  const sol = await showBalance(conn, kp.publicKey);
  console.log(`[solana-setup] balance: ${sol} SOL`);

  if (sol > 0) {
    const b58 = bs58.encode(kp.secretKey);
    console.log("\n[solana-setup] ✓ ready. Set the env var:\n");
    console.log(`  export KALI_SOLANA_DEVNET_SECRET_KEY="${b58}"\n`);
    console.log(
      "Then:  bun run dev   # solana.batchPayout will now run live on devnet.\n",
    );
  } else {
    console.error(
      "\n[solana-setup] ✗ wallet has no SOL. Try `bun scripts/solana-setup.ts airdrop` again or use the web faucet.",
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
