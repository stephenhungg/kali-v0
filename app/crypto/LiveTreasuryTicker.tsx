"use client";

import { useEffect, useState } from "react";

interface FeeSnapshot {
  treasury: number;
  communityFund: number;
  total: number;
  tradeCount: number;
}

export function LiveTreasuryTicker({
  mint,
  symbol,
  initial,
}: {
  mint: string;
  symbol: string;
  initial: FeeSnapshot;
}) {
  const [snap, setSnap] = useState<FeeSnapshot>(initial);
  const [pulse, setPulse] = useState(false);
  const [prev, setPrev] = useState<FeeSnapshot>(initial);

  useEffect(() => {
    const ev = new EventSource(`/api/coin/${mint}/fees-stream`);
    ev.onmessage = (m) => {
      try {
        const next = JSON.parse(m.data) as FeeSnapshot & { at: number };
        setSnap((current) => {
          if (next.total > current.total) {
            setPrev(current);
            setPulse(true);
            setTimeout(() => setPulse(false), 1200);
          }
          return next;
        });
      } catch {
        /* skip malformed */
      }
    };
    return () => ev.close();
  }, [mint]);

  const delta = snap.total - prev.total;

  return (
    <div
      className={`rounded-md border bg-[#0e1413] p-5 transition-all duration-300 ${
        pulse
          ? "border-[#7fae7e] shadow-[0_0_24px_0_rgba(127,174,126,0.3)]"
          : "border-[#1a2421]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
          ${symbol} live treasury · sse
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#c8e6cb]/40">
          <span className="h-2 w-2 rounded-full bg-[#7fae7e] blink-soft" />
          <span>connected · {snap.tradeCount} trades indexed</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#c8e6cb]/40">treasury</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-[#7fae7e]">
            ${snap.treasury.toFixed(2)}
          </div>
          {pulse && delta > 0 && (
            <div className="mt-1 text-[10px] text-[#7fae7e]/80">+ ${delta.toFixed(4)}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#c8e6cb]/40">community fund</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-[#b08cd1]">
            ${snap.communityFund.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#c8e6cb]/40">total</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">${snap.total.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
