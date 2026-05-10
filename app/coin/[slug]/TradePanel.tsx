"use client";

import { useEffect, useState } from "react";

interface SimResult {
  tokensOut: number;
  priceBefore: number;
  priceAfter: number;
  feeUsdc: number;
  treasuryFeeUsdc: number;
  communityFundFeeUsdc: number;
  slippagePct: number;
}

export function TradePanel({
  mint,
  symbol,
  currentPrice,
  feeBps,
  communityFundBps,
}: {
  mint: string;
  symbol: string;
  currentPrice: number;
  feeBps: number;
  communityFundBps: number;
}) {
  const [usdc, setUsdc] = useState<number>(50);
  const [acknowledged, setAcknowledged] = useState(false);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    txSignature: string;
    explorerUrl: string;
    tokensReceived: number;
    feeUsdc: number;
    priceAfter: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!usdc) return;
    void (async () => {
      try {
        // Cheap client-side estimate using current price + fee math.
        const fee = (usdc * feeBps) / 10000;
        const net = usdc - fee;
        const tokensOut = net / currentPrice;
        const slippage = 0;
        const treasuryFee = fee * (1 - communityFundBps / 10000);
        if (cancelled) return;
        setSim({
          tokensOut,
          priceBefore: currentPrice,
          priceAfter: currentPrice * 1.001,
          feeUsdc: fee,
          treasuryFeeUsdc: treasuryFee,
          communityFundFeeUsdc: fee - treasuryFee,
          slippagePct: slippage,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usdc, currentPrice, feeBps, communityFundBps]);

  async function buy() {
    if (!acknowledged) return;
    setSubmitting(true);
    setError(null);
    try {
      // v1 demo: client picks a random demo wallet. Real flow: Privy embedded wallet.
      const payerWallet =
        typeof window !== "undefined" && window.localStorage.getItem("kali_demo_wallet")
          ? window.localStorage.getItem("kali_demo_wallet")!
          : `Demo${Math.random().toString(36).slice(2, 12)}11111111111111111111`.slice(0, 44);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kali_demo_wallet", payerWallet);
      }

      const res = await fetch(`/api/coin/${mint}/buy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payerWallet,
          usdcAmount: usdc,
          payerUserId: `user_${payerWallet.slice(-8)}`,
        }),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}: ${await res.text()}`);
        setSubmitting(false);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "buy failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="chat-card flex h-full flex-col gap-4 p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--matcha-mid)]">
          trade settled
        </div>
        <div className="r-display text-3xl">
          +{result.tokensReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}
        </div>
        <div className="text-sm opacity-70">
          fee · ${result.feeUsdc.toFixed(2)} USDC routed to treasury
        </div>
        <a
          href={result.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all rounded bg-[var(--mint-pale)] px-3 py-2 font-mono text-[11px] underline-offset-2 hover:underline"
        >
          ↗ {result.txSignature.slice(0, 24)}…
        </a>
        <button
          onClick={() => {
            setResult(null);
            setSim(null);
          }}
          className="mt-auto rounded bg-[var(--matcha-deep)] px-4 py-2 text-sm text-[var(--cream)]"
        >
          buy again
        </button>
      </div>
    );
  }

  return (
    <div className="chat-card flex h-full flex-col p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">buy ${symbol}</div>
      <div className="mt-4 flex items-center gap-2">
        {[10, 25, 50, 100].map((v) => (
          <button
            key={v}
            onClick={() => setUsdc(v)}
            className={`rounded border px-3 py-2 text-sm ${
              usdc === v
                ? "border-[var(--matcha-deep)] bg-[var(--matcha-deep)] text-[var(--cream)]"
                : "border-[var(--mint-line)] hover:bg-[var(--mint-pale)]"
            }`}
          >
            ${v}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={usdc}
          onChange={(e) => setUsdc(Math.max(1, Number(e.target.value)))}
          className="ml-auto w-24 rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-right font-mono text-sm"
        />
      </div>

      {sim && (
        <div className="mt-6 space-y-2 text-sm">
          <Row label="You receive" value={`${sim.tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`} highlight />
          <Row label="Trading fee" value={`$${sim.feeUsdc.toFixed(2)} USDC`} />
          <Row
            label={`→ to treasury (${100 - communityFundBps / 100}% of fee)`}
            value={`$${sim.treasuryFeeUsdc.toFixed(2)}`}
          />
          <Row
            label={`→ to community fund (${communityFundBps / 100}% of fee)`}
            value={`$${sim.communityFundFeeUsdc.toFixed(2)}`}
          />
          <Row label="Slippage" value={`${sim.slippagePct.toFixed(2)}%`} />
        </div>
      )}

      <label className="mt-6 flex items-start gap-3 text-[11px] opacity-80">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand ${symbol} is a speculative token, not a donation, and is not tax-deductible.
          I may lose money. The nonprofit makes no promises of returns.
        </span>
      </label>

      {error && (
        <div className="mt-3 rounded border border-[var(--strawberry-deep)] bg-[var(--strawberry-soft)] px-3 py-2 text-sm text-[var(--strawberry-deep)]">
          {error}
        </div>
      )}

      <button
        onClick={buy}
        disabled={!acknowledged || submitting}
        className="mt-6 w-full rounded bg-[var(--matcha-deep)] px-6 py-3 text-[var(--cream)] disabled:opacity-50"
      >
        {submitting ? "settling…" : `Buy $${usdc} of ${symbol}`}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[13px]">
      <span className="opacity-60">{label}</span>
      <span className={`font-mono ${highlight ? "text-[var(--matcha-mid)]" : ""}`}>{value}</span>
    </div>
  );
}
