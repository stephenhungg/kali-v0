"use client";

import { useEffect, useState } from "react";

interface FeeSnapshot {
  treasury: number;
  communityFund: number;
  total: number;
  tradeCount: number;
  at: number;
}

export function LiveFeesCounter({
  mint,
  initial,
}: {
  mint: string;
  initial: { treasury: number; communityFund: number; total: number; tradeCount: number };
}) {
  const [snap, setSnap] = useState<FeeSnapshot>({ ...initial, at: Date.now() });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const ev = new EventSource(`/api/coin/${mint}/fees-stream`);
    ev.onmessage = (m) => {
      try {
        const next = JSON.parse(m.data) as FeeSnapshot;
        setSnap((prev) => {
          if (next.total > prev.total) {
            setPulse(true);
            setTimeout(() => setPulse(false), 1200);
          }
          return next;
        });
      } catch {
        /* skip malformed frame */
      }
    };
    return () => ev.close();
  }, [mint]);

  return (
    <div
      className={`mt-12 grid grid-cols-1 gap-4 rounded-md border p-6 transition-shadow md:grid-cols-3 ${
        pulse ? "source-pulse border-[var(--matcha-mid)]" : "border-[var(--mint-line)]"
      }`}
    >
      <div className="md:col-span-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
          fees to treasury · ticking live
        </div>
        <div className="r-display mt-2 text-[8vw] sm:text-[5vw] md:text-[64px]">
          ${snap.treasury.toFixed(2)}
        </div>
        <div className="text-xs opacity-60">across {snap.tradeCount} trades since launch</div>
      </div>
      <div className="flex flex-col justify-center gap-3 border-t border-[var(--mint-line)] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            community fund
          </div>
          <div className="r-display text-2xl">${snap.communityFund.toFixed(2)}</div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">total</div>
          <div className="r-display text-2xl">${snap.total.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
