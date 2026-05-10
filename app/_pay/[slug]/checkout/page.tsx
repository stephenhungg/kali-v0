/**
 * Browser-side x402 checkout. Walks an unauthenticated visitor through
 * paying via a Privy embedded wallet — under the hood it does the same
 * 402 → sign → retry dance any agent would do.
 *
 * Privy isn't required: when not configured, the page surfaces the raw
 * `curl` invocation any developer can paste to settle a payment from
 * their own keypair. This keeps the demo working even before the auth
 * provider is hooked up.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenants";
import { getOrCreateTreasuryWallet } from "@/lib/wallets/privy";

export const runtime = "nodejs";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

const USDC =
  NETWORK === "solana-mainnet"
    ? process.env.USDC_MINT_MAINNET ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : process.env.USDC_MINT_DEVNET ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ amount?: string; type?: string }>;
}

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { amount: amtStr } = await searchParams;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  const amount = Math.max(1, Number(amtStr ?? 25));

  const curlExample = [
    `curl -X GET https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${slug} \\`,
    `  -H "X-Payment: $(node -e \\"console.log(Buffer.from(JSON.stringify({x402Version:1,scheme:'exact',network:'${NETWORK}',payload:{serializedTransaction:'<base64-signed-tx>'}})).toString('base64'))\\")"`,
  ].join("\n");

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      <section className="mx-auto max-w-[760px] px-6 pt-16 pb-24 sm:px-12">
        <Link
          href={`/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60 hover:opacity-100"
        >
          ← back
        </Link>

        <h1 className="r-display mt-8 text-5xl font-medium leading-[1] tracking-tight md:text-6xl">
          Donate ${amount}{" "}
          <span className="r-italic font-light text-[var(--strawberry-deep)]">USDC</span>
        </h1>
        <p className="mt-4 max-w-[520px] text-sm opacity-80">
          One-time gift to {tenant.name}. Settles in &lt;1s on {NETWORK}. Receipt + IRS-valid PDF
          auto-issued the moment the chain confirms.
        </p>

        <div className="chat-card mt-10 p-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            payment terms (x402 accepts)
          </h2>
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="opacity-60">Network</dt>
            <dd className="font-mono">{NETWORK}</dd>
            <dt className="opacity-60">Asset</dt>
            <dd className="break-all font-mono">{USDC}</dd>
            <dt className="opacity-60">Pay to</dt>
            <dd className="break-all font-mono">{treasury.pubkey}</dd>
            <dt className="opacity-60">Min / Max</dt>
            <dd className="font-mono">$1 / $100</dd>
          </dl>
          <details className="mt-6 rounded border border-[var(--mint-line)] bg-[var(--mint-pale)] p-4 text-sm">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              build it yourself (cli)
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
              {curlExample}
            </pre>
            <p className="mt-2 text-[11px] opacity-60">
              Or use the Kali helper: <code>bun scripts/x402-donate.ts --tenant {slug} --amount {amount}</code>
            </p>
          </details>
        </div>

        <div className="mt-6 chat-card p-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            embedded wallet
          </h2>
          <p className="mt-2 text-sm">
            Sign in with your email and Kali's Privy embedded wallet auto-funds itself from devnet
            faucet for the demo. Configure <code>PRIVY_APP_ID</code> + <code>PRIVY_APP_SECRET</code> to
            enable this flow.
          </p>
          <button
            disabled
            className="mt-6 cursor-not-allowed rounded bg-[var(--matcha-deep)] px-6 py-3 text-[var(--cream)] opacity-50"
          >
            Connect Privy wallet (configure to enable)
          </button>
        </div>
      </section>
    </main>
  );
}
