/**
 * Generate a fresh Solana devnet keypair, save it to ~/.config/solana/, wire it
 * into .env.local, and airdrop 2 free devnet SOL. One-shot — re-running aborts
 * if a keypair already exists at the target path (use --force to overwrite).
 *
 * Usage:
 *   bun scripts/make-devnet-wallet.ts            # safe, aborts if file exists
 *   bun scripts/make-devnet-wallet.ts --force    # overwrite existing
 *   bun scripts/make-devnet-wallet.ts --no-airdrop  # skip airdrop step
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { writeFile, readFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const NO_AIRDROP = args.includes("--no-airdrop");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const KEYPAIR_DIR = path.join(os.homedir(), ".config", "solana");
const KEYPAIR_PATH = path.join(KEYPAIR_DIR, "kali-devnet.json");
const ENV_PATH = path.join(process.cwd(), ".env.local");
const AIRDROP_SOL = 2;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("───────────────────────────────────────────────────────────");
  console.log("  kali · devnet wallet generator");
  console.log("───────────────────────────────────────────────────────────\n");

  // 1. Check existing keypair.
  if ((await fileExists(KEYPAIR_PATH)) && !FORCE) {
    const existing = await readFile(KEYPAIR_PATH, "utf8");
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(existing)));
    const conn = new Connection(RPC, "confirmed");
    const balance = await conn.getBalance(kp.publicKey).catch(() => 0);
    console.log("⚠ keypair already exists at", KEYPAIR_PATH);
    console.log("  pubkey :", kp.publicKey.toBase58());
    console.log("  balance:", (balance / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    console.log("\n  use --force to regenerate, or move on to env-wiring.\n");
    await wireEnv(existing);
    return;
  }

  // 2. Generate fresh keypair.
  await mkdir(KEYPAIR_DIR, { recursive: true });
  const kp = Keypair.generate();
  const secretArray = Array.from(kp.secretKey);
  const json = JSON.stringify(secretArray);
  await writeFile(KEYPAIR_PATH, json, { mode: 0o600 });
  console.log("✓ generated keypair");
  console.log("  pubkey :", kp.publicKey.toBase58());
  console.log("  saved  :", KEYPAIR_PATH, "(mode 0600)");
  console.log("");

  // 3. Wire .env.local.
  await wireEnv(json);

  // 4. Airdrop.
  if (NO_AIRDROP) {
    console.log("⏭  skipping airdrop (--no-airdrop)\n");
  } else {
    await doAirdrop(kp);
  }

  // 5. Final state.
  const conn = new Connection(RPC, "confirmed");
  const balance = await conn.getBalance(kp.publicKey).catch(() => 0);
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  ✓ DONE");
  console.log("───────────────────────────────────────────────────────────");
  console.log("  pubkey  :", kp.publicKey.toBase58());
  console.log("  balance :", (balance / LAMPORTS_PER_SOL).toFixed(4), "SOL (devnet)");
  console.log(
    "  explorer:",
    `https://explorer.solana.com/address/${kp.publicKey.toBase58()}?cluster=devnet`,
  );
  console.log("");
  console.log("  next:");
  console.log("    1. (re)start dev server:  bun dev");
  console.log("    2. open the launcher:     http://localhost:3000/crypto");
  console.log("    3. type symbol+name, hit launch — coin deploys onchain");
  console.log("───────────────────────────────────────────────────────────");
}

async function wireEnv(secretJson: string): Promise<void> {
  let env = "";
  try {
    env = await readFile(ENV_PATH, "utf8");
  } catch {
    /* file may not exist yet */
  }
  const lines = env.split("\n");
  const has = (key: string) =>
    lines.some((l) => l.startsWith(`${key}=`) && l.split("=")[1]?.trim().length);

  const updates: Array<[string, string]> = [];
  if (!has("KALI_SOLANA_DEVNET_SECRET_KEY")) {
    updates.push(["KALI_SOLANA_DEVNET_SECRET_KEY", secretJson]);
  } else {
    console.log("✓ .env.local already has KALI_SOLANA_DEVNET_SECRET_KEY (left as-is)");
  }
  if (!has("KALI_X402_NETWORK")) {
    updates.push(["KALI_X402_NETWORK", "solana-devnet"]);
  }
  if (!has("SOLANA_RPC_URL")) {
    updates.push(["SOLANA_RPC_URL", "https://api.devnet.solana.com"]);
  }

  if (updates.length === 0) {
    console.log("✓ .env.local already wired — nothing to add\n");
    return;
  }

  let appended = "";
  if (env.length > 0 && !env.endsWith("\n")) appended += "\n";
  appended += "\n# ── kali devnet wallet (added by scripts/make-devnet-wallet.ts) ──\n";
  for (const [k, v] of updates) appended += `${k}=${v}\n`;
  await writeFile(ENV_PATH, env + appended, "utf8");

  console.log("✓ wired .env.local");
  for (const [k] of updates) console.log("  +", k);
  console.log("");
}

async function doAirdrop(kp: Keypair): Promise<void> {
  const conn = new Connection(RPC, "confirmed");
  console.log(`→ requesting ${AIRDROP_SOL} SOL airdrop on devnet…`);
  try {
    const sig = await conn.requestAirdrop(
      kp.publicKey,
      AIRDROP_SOL * LAMPORTS_PER_SOL,
    );
    console.log("  tx:", sig);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("  ✓ confirmed");
  } catch (e) {
    console.error("  ✗ airdrop failed:", e instanceof Error ? e.message : e);
    console.error("    (devnet faucet rate-limits aggressively. retry in a minute,");
    console.error("     or visit https://faucet.solana.com and paste your pubkey)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
