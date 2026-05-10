/**
 * Demo CLI client. Hits the x402 endpoint, builds + signs an inner USDC
 * transfer, retries with X-Payment, prints the receipt + Solana Explorer
 * URL. Usage:
 *
 *   bun scripts/x402-donate.ts --tenant rivertown --amount 25 \
 *     --memo "Q3 climate giving"
 *
 * Defaults to localhost:3000 / Solana devnet. Set BASE_URL to point at
 * staging or prod.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";

interface Args {
  tenant: string;
  amount: number;
  memo?: string;
  network: "solana-devnet" | "solana-mainnet";
  baseUrl: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d?: string): string => {
    const i = argv.indexOf(`--${k}`);
    if (i === -1) return d ?? "";
    return argv[i + 1] ?? "";
  };
  return {
    tenant: get("tenant", "rivertown"),
    amount: Number(get("amount", "25")),
    memo: get("memo", "kali-x402 demo donation"),
    network:
      ((get("network", process.env.KALI_X402_NETWORK ?? "solana-devnet") as
        | "solana-devnet"
        | "solana-mainnet") || "solana-devnet"),
    baseUrl: get("base", process.env.KALI_PAY_BASE ?? "http://localhost:3000"),
  };
}

function loadFunder(): Keypair {
  const raw = process.env.KALI_SOLANA_DEVNET_SECRET_KEY;
  if (!raw) {
    console.error(
      "KALI_SOLANA_DEVNET_SECRET_KEY not set — cannot sign tx. Set it to a base58 secret or JSON-array bytes.",
    );
    process.exit(1);
  }
  if (raw.trim().startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

async function main() {
  const args = parseArgs();
  const usdcMint =
    args.network === "solana-mainnet"
      ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

  const url = `${args.baseUrl}/api/x402/${args.tenant}`;

  console.log(`[x402-donate] GET ${url}`);
  const quoteRes = await fetch(url);
  if (quoteRes.status !== 402) {
    console.error("expected 402, got", quoteRes.status, await quoteRes.text());
    process.exit(1);
  }
  const quote = (await quoteRes.json()) as {
    accepts: Array<{ network: string; asset: string; payTo: string }>;
  };
  const accept = quote.accepts.find((a) => a.network === args.network);
  if (!accept) {
    console.error("no accepts entry for network", args.network);
    process.exit(1);
  }
  console.log(`[x402-donate] payTo: ${accept.payTo}`);

  const funder = loadFunder();
  const rpcUrl =
    args.network === "solana-mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const conn = new Connection(rpcUrl, "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");

  const recipient = new PublicKey(accept.payTo);
  const recipientAta = getAssociatedTokenAddressSync(
    new PublicKey(usdcMint),
    recipient,
    true,
  );
  const payerAta = getAssociatedTokenAddressSync(
    new PublicKey(usdcMint),
    funder.publicKey,
    true,
  );
  const baseUnits = BigInt(Math.round(args.amount * 1_000_000));

  const tx = new Transaction();
  tx.feePayer = funder.publicKey;
  tx.recentBlockhash = blockhash;
  tx.add(
    createTransferInstruction(
      payerAta,
      recipientAta,
      funder.publicKey,
      baseUnits,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  if (args.memo) {
    tx.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        data: Buffer.from(args.memo, "utf8"),
      }),
    );
  }

  // Sign locally — facilitator will broadcast.
  tx.sign(funder);

  const xPayment = {
    x402Version: 1,
    scheme: "exact" as const,
    network: args.network,
    payload: {
      serializedTransaction: tx.serialize().toString("base64"),
      metadata: { memo: args.memo },
    },
  };
  const headerVal = Buffer.from(JSON.stringify(xPayment), "utf8").toString("base64");

  console.log(`[x402-donate] retrying with X-Payment...`);
  const settledRes = await fetch(url, {
    method: "GET",
    headers: { "X-Payment": headerVal },
  });
  console.log(`[x402-donate] status ${settledRes.status}`);
  const body = await settledRes.text();
  try {
    const parsed = JSON.parse(body);
    console.log(JSON.stringify(parsed, null, 2));
    if (parsed.receipt?.explorer_url) {
      console.log(`\n  ↗ ${parsed.receipt.explorer_url}\n`);
    }
  } catch {
    console.log(body);
  }
  void SystemProgram;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
