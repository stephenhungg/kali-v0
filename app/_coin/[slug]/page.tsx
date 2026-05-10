/**
 * Public cause-coin trading page (coin.kalilabs.ai/<slug>).
 *
 * Above the fold (cspec §8 rule 6): cause hero — mission, programs, impact
 * metrics, fees-to-treasury counter. NOT the chart. Below: chart, holders,
 * recent trades, buy/sell drawer with the disclaimer required by cspec §8
 * rule 2.
 *
 * Donation CTA at the top redirects to pay.kalilabs.ai/<slug> for the
 * tax-deductible alternative — keeps the two flows visually distinct.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenants";
import {
  curveStateFor,
  cumulativeFees,
  listHolders,
  listTrades,
  loadCoinByTenant,
} from "@/lib/causecoin/trading";
import { TradePanel } from "./TradePanel";
import { LiveFeesCounter } from "./LiveFeesCounter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function explorerFor(addr: string, kind: "tx" | "address" = "address"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

function shortenWallet(w: string): string {
  return w.length <= 12 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
}

export default async function CoinPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const coin = loadCoinByTenant(tenant.id);
  if (!coin) {
    return (
      <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
        <section className="mx-auto max-w-[820px] px-6 pt-24 pb-16 sm:px-12">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            no cause coin yet
          </div>
          <h1 className="r-display mt-6 text-5xl">{tenant.name} hasn't launched a coin.</h1>
          <p className="mt-4 max-w-[560px] text-sm opacity-80">
            Cause Coins are speculative tokens — proceeds from trading fees route to the
            nonprofit's treasury. To launch one, run{" "}
            <code className="rounded bg-[var(--mint-pale)] px-1.5">bun scripts/launch-cause-coin.ts</code>{" "}
            or use the dashboard admin button.
          </p>
          <Link
            href={`https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${slug}`}
            className="mt-10 inline-block rounded bg-[var(--matcha-deep)] px-6 py-3 text-[var(--cream)]"
          >
            Donate via x402 instead →
          </Link>
        </section>
      </main>
    );
  }

  const { config, progression } = curveStateFor(coin);
  const price = config.initialPriceUsdc + config.slope * progression;
  const marketCap = price * config.totalSupply;
  const fees = cumulativeFees(coin.id);
  const holders = listHolders(coin.id);
  const top5 = holders.slice(0, 5).reduce((s, h) => s + h.balance, 0);
  const totalSupplyHeld = holders.reduce((s, h) => s + h.balance, 0);
  const concentration = totalSupplyHeld > 0 ? (top5 / totalSupplyHeld) * 100 : 0;
  const recentTrades = listTrades(coin.id, 25);
  const graduationProgress = Math.min(100, (marketCap / coin.graduationThresholdUsd) * 100);

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      {/* disclaimer banner — cspec §6 row 3 */}
      <div className="border-b border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)] text-[var(--strawberry-deep)]">
        <div className="mx-auto max-w-[1400px] px-6 py-3 text-center text-sm sm:px-12">
          <strong>${coin.symbol} is a speculative token, NOT a donation.</strong> You may lose
          money. The nonprofit makes no promises of returns. Token grants governance over a
          community fund only. <strong>NOT tax-deductible</strong> — for tax-deductible giving use{" "}
          <Link
            href={`https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${slug}`}
            className="underline-offset-2 hover:underline"
          >
            pay.kalilabs.ai/{slug}
          </Link>
          .
        </div>
      </div>

      {/* cause hero — above the fold */}
      <section className="mx-auto max-w-[1400px] px-6 pt-12 pb-10 sm:px-12">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
          ${coin.symbol} · {tenant.name}
        </div>
        <h1 className="r-display mt-6 text-[10vw] font-medium leading-[0.95] tracking-tight sm:text-[6.5vw] md:text-[80px]">
          Trade ${coin.symbol},{" "}
          <span className="r-italic font-light text-[var(--strawberry-deep)]">
            fund the cause.
          </span>
        </h1>
        <p className="mt-6 max-w-[640px] text-base opacity-80">
          {tenant.mission} Every trade of ${coin.symbol} routes 1% in fees to {tenant.name}'s
          treasury. The longer you hold, the more your trading volume contributes.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Fees to treasury" value={`$${fees.treasury.toFixed(2)}`} sub="ticking live ↓" />
          <Stat
            label="Market cap"
            value={`$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`graduation at $${(coin.graduationThresholdUsd / 1000).toFixed(0)}K`}
          />
          <Stat label="Holders" value={`${holders.length}`} sub={`top 5: ${concentration.toFixed(1)}% of supply`} />
          <Stat
            label="Status"
            value={coin.graduationStatus}
            sub={`${graduationProgress.toFixed(0)}% of bonding curve`}
          />
        </div>

        <LiveFeesCounter mint={coin.mint} initial={fees} />
      </section>

      {/* trading + chart */}
      <section className="border-y border-[var(--mint-line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-6 py-12 sm:px-12 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="r-display text-2xl">price (linear bonding curve)</h2>
              <span className="rounded-full bg-[var(--mint-pale)] px-2 py-[2px] text-[10px] uppercase tracking-wide">
                {NETWORK}
              </span>
            </div>
            <PriceChart trades={recentTrades.map((t) => ({ time: t.blockTime, price: t.priceAfter }))} />
          </div>

          <TradePanel
            mint={coin.mint}
            symbol={coin.symbol}
            currentPrice={price}
            feeBps={coin.feeBps}
            communityFundBps={coin.communityFundBps}
          />
        </div>
      </section>

      {/* holders + trades */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-16 sm:px-12 lg:grid-cols-2">
        <div>
          <h2 className="r-display text-2xl">holders</h2>
          <p className="mt-1 text-xs opacity-60">
            top {Math.min(20, holders.length)} of {holders.length}
          </p>
          <ul className="mt-6 divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
            {holders.length === 0 && (
              <li className="py-4 text-sm opacity-50">No trades yet — be the first.</li>
            )}
            {holders.slice(0, 20).map((h) => (
              <li key={h.wallet} className="row-rise grid grid-cols-[1fr_auto_auto] gap-4 py-3 items-center">
                <div className="font-mono text-sm">{shortenWallet(h.wallet)}</div>
                <div className="text-right font-mono text-sm">
                  {h.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="ml-2 opacity-60">
                    ({totalSupplyHeld > 0 ? ((h.balance / totalSupplyHeld) * 100).toFixed(2) : "0"}%)
                  </span>
                </div>
                <div className="text-right text-xs text-[var(--matcha-mid)]">
                  contributed ${h.cumulativeContributedUsd.toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="r-display text-2xl">recent trades</h2>
          <p className="mt-1 text-xs opacity-60">last {Math.min(20, recentTrades.length)} of {recentTrades.length}</p>
          <ul className="mt-6 divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
            {recentTrades.length === 0 && (
              <li className="py-4 text-sm opacity-50">No trades yet.</li>
            )}
            {recentTrades.slice(0, 20).map((t) => (
              <li key={t.id} className="row-rise grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3">
                <span
                  className={`font-mono text-[11px] uppercase tracking-wide ${
                    t.side === "buy" ? "text-[var(--matcha-mid)]" : "text-[var(--strawberry-deep)]"
                  }`}
                >
                  {t.side}
                </span>
                <div className="font-mono text-sm">{shortenWallet(t.wallet)}</div>
                <div className="text-right font-mono text-sm">
                  ${t.usdcAmount.toFixed(2)}
                  <a
                    href={explorerFor(t.txSignature, "tx")}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-3 text-[11px] underline-offset-2 hover:underline"
                  >
                    ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* governance teaser */}
      <section className="border-t border-[var(--mint-line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-12 sm:px-12 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[600px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
              member-directed giving
            </div>
            <h3 className="r-display mt-2 text-2xl">
              {coin.communityFundBps / 100}% of trading fees flow to a holder-governed fund.
            </h3>
            <p className="mt-2 text-sm opacity-70">
              Holders propose grants. Votes weighted by snapshotted balance. Quarterly disbursements
              executed onchain.
            </p>
          </div>
          <Link
            href={`/${slug}/governance`}
            className="rounded bg-[var(--matcha-deep)] px-6 py-3 text-[var(--cream)]"
          >
            View proposals →
          </Link>
        </div>
      </section>

      {/* footer + LP-lock badge if graduated */}
      <footer className="border-t border-[var(--mint-line)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-8 sm:px-12">
          <span className="font-mono text-xs opacity-60">
            mint{" "}
            <a href={explorerFor(coin.mint)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {shortenWallet(coin.mint)}
            </a>{" "}
            · pool{" "}
            <a href={explorerFor(coin.bondingCurvePool)} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {shortenWallet(coin.bondingCurvePool)}
            </a>
          </span>
          {coin.graduationStatus === "graduated" && coin.lpLockStreamflowId && (
            <span className="rounded-full bg-[var(--matcha-mid)] px-3 py-1 text-xs text-white">
              graduated · LP locked 12mo
            </span>
          )}
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="chat-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <div className="r-display mt-2 text-2xl">{value}</div>
      <div className="mt-1 text-xs opacity-60">{sub}</div>
    </div>
  );
}

function PriceChart({ trades }: { trades: Array<{ time: number; price: number }> }) {
  // Lightweight inline SVG sparkline. Real Recharts/lightweight-charts wires in via TradePanel.
  if (trades.length < 2) {
    return (
      <div className="mt-4 flex h-[280px] items-center justify-center rounded-md border border-[var(--mint-line)] bg-[var(--cream)] text-sm opacity-50">
        not enough trades for a chart yet
      </div>
    );
  }
  const sorted = [...trades].sort((a, b) => a.time - b.time);
  const min = Math.min(...sorted.map((t) => t.price));
  const max = Math.max(...sorted.map((t) => t.price));
  const range = max - min || 1;
  const points = sorted
    .map((t, i) => {
      const x = (i / (sorted.length - 1)) * 100;
      const y = 100 - ((t.price - min) / range) * 90 - 5;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <div className="mt-4 rounded-md border border-[var(--mint-line)] bg-[var(--cream)] p-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[280px] w-full">
        <polyline
          fill="none"
          stroke="var(--matcha-mid)"
          strokeWidth="0.6"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] opacity-60">
        <span>{new Date(sorted[0].time * 1000).toLocaleString()}</span>
        <span>{new Date(sorted[sorted.length - 1].time * 1000).toLocaleString()}</span>
      </div>
    </div>
  );
}
