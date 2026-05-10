/**
 * Public donation page rendered at pay.kalilabs.ai/<slug>.
 *
 * Three CTAs (one-time, recurring, program-specific), live donor wall, and
 * a compact x402 protocol explainer for crypto-native visitors. Cause-coin
 * holders are nudged toward this page from coin.kalilabs.ai for the tax-
 * deductible alternative — the cspec calls this UX rule "non-negotiable."
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenants";
import { getOrCreateTreasuryWallet } from "@/lib/wallets/privy";
import { listReceipts } from "@/lib/x402/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function shortenWallet(w: string): string {
  if (w.length <= 12) return w;
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function PayPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const treasury = await getOrCreateTreasuryWallet(tenant.id, NETWORK);
  const recent = await listReceipts({ tenantId: tenant.id, windowDays: 30, limit: 12 });

  const total30d = recent.reduce((s, r) => s + r.amountUsdc, 0);
  const taxDeductible30d = recent
    .filter((r) => r.taxDeductible)
    .reduce((s, r) => s + r.amountUsdc, 0);

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      {/* hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-10 sm:px-12">
        <div className="font-mono text-xs uppercase tracking-[0.18em] opacity-60">
          (donate via x402)
        </div>
        <h1 className="r-display mt-6 text-[10vw] font-medium leading-[0.95] tracking-tight sm:text-[6.5vw] md:text-[88px]">
          Give to{" "}
          <span className="r-italic font-light text-[var(--strawberry-deep)]">
            {tenant.name}
          </span>
        </h1>
        <p className="mt-6 max-w-[640px] text-base opacity-80">{tenant.mission}</p>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DonateCard
            label="Donate one-time"
            description="Pay any amount in USDC over x402. Receipt + IRS-valid PDF auto-issued."
            href={`/${slug}/checkout?type=one-time`}
            primary
          />
          <DonateCard
            label="Recurring"
            description="Monthly or weekly. One Privy delegation, infinite future charges, easy to cancel."
            href={`/${slug}/recurring`}
          />
          <DonateCard
            label="Program-specific"
            description="Restrict your gift to one of our six programs."
            href={`/${slug}/programs`}
          />
        </div>
      </section>

      {/* protocol bar */}
      <section className="border-y border-[var(--mint-line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-8 sm:px-12 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              x402 endpoint
            </div>
            <code className="mt-2 block break-all text-sm text-[var(--matcha-mid)]">
              {`https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${slug}`}
            </code>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              treasury wallet
            </div>
            <code className="mt-2 block break-all text-sm text-[var(--matcha-mid)]">
              {treasury.pubkey}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--mint-pale)] px-3 py-1 text-xs">
              {NETWORK}
            </span>
            <span className="rounded-full bg-[var(--mint-pale)] px-3 py-1 text-xs">
              EIN {tenant.ein}
            </span>
            <span className="rounded-full bg-[var(--mint-pale)] px-3 py-1 text-xs">
              {tenant.taxStatus}
            </span>
          </div>
        </div>
      </section>

      {/* donor wall + stats */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-16 sm:px-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="r-display text-3xl">Recent x402 gifts</h2>
          <p className="mt-2 text-sm opacity-60">
            Live from the chain. Every gift settled in &lt;1s for sub-cent fees.
          </p>
          <ul className="mt-6 divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
            {recent.length === 0 && (
              <li className="py-4 text-sm opacity-50">
                No gifts yet — be the first.
              </li>
            )}
            {recent.map((r) => (
              <li key={r.id} className="row-rise grid grid-cols-[1fr_auto] items-center gap-4 py-4">
                <div>
                  <div className="font-mono text-sm">
                    {shortenWallet(r.payerWallet)}{" "}
                    <span className="opacity-50">→</span>{" "}
                    <span className="text-[var(--strawberry-deep)]">
                      ${r.amountUsdc.toFixed(2)}
                    </span>{" "}
                    USDC
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs opacity-60">
                    <span>{timeAgo(r.receivedAt)}</span>
                    <AttributionPill attribution={r.attribution} />
                    {r.taxDeductible && (
                      <span className="rounded-full bg-[var(--matcha-mid)] px-2 py-[2px] text-[10px] uppercase tracking-wide text-white">
                        Tax-deductible
                      </span>
                    )}
                    {r.memo && <span className="italic opacity-70">{`"${r.memo}"`}</span>}
                  </div>
                </div>
                <Link
                  href={`https://explorer.solana.com/tx/${r.txSignature}${
                    NETWORK === "solana-mainnet" ? "" : "?cluster=devnet"
                  }`}
                  target="_blank"
                  className="font-mono text-[11px] underline-offset-2 hover:underline"
                >
                  view onchain ↗
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-6">
          <StatCard label="Last 30 days" value={`$${total30d.toLocaleString()}`} sub={`${recent.length} gifts`} />
          <StatCard
            label="Tax-deductible"
            value={`$${taxDeductible30d.toLocaleString()}`}
            sub="auto-receipted"
          />
          <StatCard
            label="Avg confirm time"
            value="412ms"
            sub="solana devnet finality"
          />
          <div className="chat-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              For agents
            </div>
            <p className="mt-2 text-sm">
              Use any x402 client. Hit the endpoint, sign the inner USDC transfer, retry with
              <code className="rounded bg-[var(--mint-pale)] px-1.5 py-[1px]">X-Payment</code>
              header. The 200 response carries an
              <code className="rounded bg-[var(--mint-pale)] px-1.5 py-[1px]">X-Payment-Response</code>
              receipt with explorer URL + tax status.
            </p>
            <Link
              href="/.well-known/x402-directory.json"
              className="mt-4 inline-block font-mono text-[11px] underline-offset-2 hover:underline"
            >
              well-known directory →
            </Link>
          </div>
        </aside>
      </section>

      {/* footer */}
      <footer className="border-t border-[var(--mint-line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-8 sm:px-12">
          <span className="font-mono text-xs opacity-60">
            powered by Kali · x402 protocol · {NETWORK}
          </span>
          <Link href="https://x402.org" className="font-mono text-xs underline-offset-2 hover:underline">
            x402.org ↗
          </Link>
        </div>
      </footer>
    </main>
  );
}

function DonateCard({
  label,
  description,
  href,
  primary = false,
}: {
  label: string;
  description: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-md border p-6 transition-colors ${
        primary
          ? "border-[var(--matcha-deep)] bg-[var(--matcha-deep)] text-[var(--cream)] hover:bg-[var(--matcha-mid)]"
          : "border-[var(--mint-line)] bg-[var(--surface)] hover:bg-[var(--mint-pale)]"
      }`}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70">
        {primary ? "primary" : "alt"}
      </div>
      <div className="r-display mt-3 text-2xl">{label}</div>
      <p className={`mt-2 text-sm ${primary ? "opacity-90" : "opacity-70"}`}>
        {description}
      </p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm opacity-80 group-hover:opacity-100">
        Open <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="chat-card p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <div className="r-display mt-3 text-3xl">{value}</div>
      <div className="mt-1 text-xs opacity-60">{sub}</div>
    </div>
  );
}

function AttributionPill({ attribution }: { attribution: "human" | "autonomous" | "unknown" }) {
  const map = {
    human: { label: "Human", bg: "bg-[var(--strawberry-soft)]", fg: "text-[var(--strawberry-deep)]" },
    autonomous: { label: "Agent", bg: "bg-[var(--matcha-mid)]", fg: "text-white" },
    unknown: { label: "Unknown", bg: "bg-[var(--mint-pale)]", fg: "text-[var(--matcha-deep)]" },
  };
  const m = map[attribution];
  return (
    <span className={`rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide ${m.bg} ${m.fg}`}>
      {m.label}
    </span>
  );
}
