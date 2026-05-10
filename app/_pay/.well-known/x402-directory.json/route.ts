/**
 * Public agent-discoverable directory of every nonprofit accepting x402
 * via Kali. Served from `pay.kalilabs.ai/.well-known/x402-directory.json`
 * (rewrite handled by middleware.ts) and from the path-form for non-
 * subdomain crawlers.
 *
 * This is the canonical "phone book" the agent ecosystem reads when a
 * user asks "donate to a Sacramento youth nonprofit." Format mirrors the
 * x402 spec's recommended discovery format.
 */

import { NextResponse } from "next/server";
import { listTenants } from "@/lib/tenants";
import { getOrCreateTreasuryWallet } from "@/lib/wallets/privy";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 300; // 5 min

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";
const USDC =
  NETWORK === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export async function GET() {
  const tenants = await listTenants();
  const entries = await Promise.all(
    tenants.map(async (t) => {
      const treasury = await getOrCreateTreasuryWallet(t.id, NETWORK);
      return {
        slug: t.slug,
        kali_entity_id: t.id,
        name: t.name,
        ein: t.ein,
        tax_status: t.taxStatus,
        mission: t.mission,
        programs: t.programs,
        endpoints: {
          one_time: `https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${t.slug}`,
          recurring: `https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${t.slug}/recurring`,
        },
        accepts: [
          {
            scheme: "exact",
            network: NETWORK,
            asset: USDC,
            payTo: treasury.pubkey,
            minAmountRequired: "1000000",
            maxAmountRequired: "100000000",
          },
        ],
      };
    }),
  );

  return NextResponse.json(
    {
      version: 1,
      protocol: "x402",
      generatedAt: new Date().toISOString(),
      registry: {
        operator: "Kali Labs",
        url: "https://kalilabs.ai",
      },
      entries,
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
