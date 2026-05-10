"use client";

import { useEffect, useState } from "react";
import { CuteCard } from "@/components/kawaii/CutePrimitives";
import { StickerAccent } from "@/components/kawaii/StickerAccent";

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
    <CuteCard
      tone="matcha"
      style={{
        padding: 22,
        transition: "box-shadow 300ms ease, transform 300ms ease",
        boxShadow: pulse
          ? "3px 5px 0 var(--sticker-shadow-deep), 0 0 0 4px rgba(122, 178, 129, 0.25)"
          : "3px 4px 0 var(--sticker-shadow-deep)",
        transform: pulse ? "translateY(-2px)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="kawaii-mono-tag" style={{ color: "var(--matcha-deep-warm)" }}>
          ${symbol} live treasury · sse
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--mute)",
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--matcha)",
            }}
            className="blink-soft"
          />
          connected · {snap.tradeCount} trades indexed
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: 22,
        }}
      >
        <div style={{ position: "relative" }}>
          <div className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
            treasury
          </div>
          <div
            className="kawaii-display"
            style={{
              fontSize: 40,
              color: "var(--matcha-deep-warm)",
              marginTop: 4,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${snap.treasury.toFixed(2)}
          </div>
          {pulse && delta > 0 && (
            <span
              className="sticker-pop"
              style={{
                position: "absolute",
                top: -10,
                right: 0,
                background: "var(--sakura)",
                color: "white",
                fontSize: 11,
                fontWeight: 800,
                padding: "3px 9px",
                borderRadius: 999,
                border: "2px solid white",
                boxShadow: "1px 2px 0 var(--sticker-shadow)",
                fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
              }}
            >
              + ${delta.toFixed(4)}
            </span>
          )}
          {pulse && (
            <StickerAccent
              prop="sparkle"
              size={28}
              tiltDeg={20}
              style={{ position: "absolute", top: -16, left: -10 }}
              className="sparkle-twinkle"
            />
          )}
        </div>
        <div>
          <div className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
            community fund
          </div>
          <div
            className="kawaii-display"
            style={{
              fontSize: 26,
              color: "var(--ink)",
              marginTop: 4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${snap.communityFund.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
            total fees
          </div>
          <div
            className="kawaii-display"
            style={{
              fontSize: 26,
              color: "var(--ink)",
              marginTop: 4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${snap.total.toFixed(2)}
          </div>
        </div>
      </div>
    </CuteCard>
  );
}
