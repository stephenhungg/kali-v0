/**
 * Holder dashboard — "you've contributed $X.XX to {tenant} via Y trades."
 * Renders for a wallet stored in localStorage by the demo flow; production
 * uses Privy's connected wallet identity.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CoinSummary {
  coin: {
    symbol: string;
    name: string;
    mint: string;
    bondingCurvePool: string;
  };
  market: {
    priceUsdc: number;
    cumulativeFeesToTreasuryUsd: number;
  };
  topHolders: Array<{ wallet: string; balance: number; cumulativeContributedUsd: number }>;
  recentTrades: Array<{
    txSignature: string;
    wallet: string;
    side: "buy" | "sell";
    usdcAmount: number;
    tokenAmount: number;
    feeUsdc: number;
    blockTime: number;
    explorerUrl: string;
  }>;
}

export default function HolderDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [summary, setSummary] = useState<CoinSummary | null>(null);

  useEffect(() => {
    void params.then((p) => setSlug(p.slug));
    if (typeof window !== "undefined") {
      setWallet(window.localStorage.getItem("kali_demo_wallet"));
    }
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    void fetch(`/api/coin/${slug}`).then(async (res) => {
      if (res.ok) setSummary((await res.json()) as CoinSummary);
    });
  }, [slug]);

  if (!summary) {
    return (
      <main className="min-h-screen bg-[var(--cream)] p-8 text-sm opacity-60">loading…</main>
    );
  }

  const myTrades = summary.recentTrades.filter((t) => t.wallet === wallet);
  const myHolder = summary.topHolders.find((h) => h.wallet === wallet);

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      <section className="mx-auto max-w-[820px] px-6 pt-16 pb-24 sm:px-12">
        <Link
          href={`/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60 hover:opacity-100"
        >
          ← back
        </Link>

        <h1 className="r-display mt-8 text-5xl">your ${summary.coin.symbol} contribution</h1>

        {!wallet && (
          <div className="chat-card mt-12 p-6 text-sm opacity-70">
            No wallet connected. Place a buy on the trading page first — we'll remember the demo
            wallet locally.
          </div>
        )}

        {wallet && !myHolder && (
          <div className="chat-card mt-12 p-6 text-sm opacity-70">
            Wallet <span className="font-mono">{shortenWallet(wallet)}</span> doesn't currently hold
            any ${summary.coin.symbol}.
          </div>
        )}

        {myHolder && (
          <>
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
              <Card label="balance" value={myHolder.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} sub={`${summary.coin.symbol}`} />
              <Card
                label="contributed"
                value={`$${myHolder.cumulativeContributedUsd.toFixed(2)}`}
                sub="to treasury"
              />
              <Card label="trades" value={`${myTrades.length}`} sub="lifetime" />
            </div>

            <h2 className="r-display mt-12 text-2xl">my trades</h2>
            <ul className="mt-4 divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
              {myTrades.map((t) => (
                <li key={t.txSignature} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                  <span className={`font-mono text-[11px] uppercase ${t.side === "buy" ? "text-[var(--matcha-mid)]" : "text-[var(--strawberry-deep)]"}`}>
                    {t.side}
                  </span>
                  <div className="font-mono text-sm">
                    ${t.usdcAmount.toFixed(2)} ·{" "}
                    {t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${summary.coin.symbol}
                  </div>
                  <a
                    href={t.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] underline-offset-2 hover:underline"
                  >
                    ↗
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="chat-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="r-display mt-2 text-2xl">{value}</div>
      <div className="mt-1 text-xs opacity-60">{sub}</div>
    </div>
  );
}

function shortenWallet(w: string): string {
  return w.length <= 12 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
}
