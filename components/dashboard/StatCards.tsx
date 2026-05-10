"use client";

import { useEffect, useState } from "react";
import { CuteStat } from "../kawaii/CutePrimitives";
import type { StickerProp } from "../kawaii/StickerAccent";

interface StatCardsProps {
  tenantName: string;
}

interface DashboardStats {
  recordsIndexed: number;
  connectorsConnected: number;
  donations: { count: number; totalUsd: number };
  cashOnHand: { totalUsd: number; bankAccountCount: number };
  grantsInPipeline: { count: number; requestedTotalUsd: number };
  lastSyncAt: string | null;
}

interface StatRow {
  id: string;
  label: string;
  value: string;
  sub: string;
  accent: StickerProp;
  tone: "paper" | "cloud" | "mochi" | "matcha" | "lemon";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function rowsFor(s: DashboardStats): StatRow[] {
  return [
    {
      id: "records",
      label: "records indexed",
      value: s.recordsIndexed.toLocaleString(),
      sub: `${s.connectorsConnected} sources`,
      accent: "cloud",
      tone: "cloud",
    },
    {
      id: "donations",
      label: "donations · all time",
      value: s.donations.count.toLocaleString(),
      sub: `$${(s.donations.totalUsd / 1_000_000).toFixed(2)}M total`,
      accent: "strawberry",
      tone: "mochi",
    },
    {
      id: "cash",
      label: `cash · ${s.cashOnHand.bankAccountCount} accounts`,
      value: `$${(s.cashOnHand.totalUsd / 1_000_000).toFixed(2)}M`,
      sub: "across bank accounts",
      accent: "matcha-bowl",
      tone: "matcha",
    },
    {
      id: "grants",
      label: "grants in pipeline",
      value: s.grantsInPipeline.count.toLocaleString(),
      sub: `$${(s.grantsInPipeline.requestedTotalUsd / 1_000_000).toFixed(2)}M requested`,
      accent: "chart",
      tone: "lemon",
    },
  ];
}

export function StatCards({ tenantName: _tenantName }: StatCardsProps) {
  void _tenantName;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/dashboard/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((data: DashboardStats) => {
        if (alive) setStats(data);
      })
      .catch((e: unknown) => {
        if (alive) setError(typeof e === "string" ? e : "fetch failed");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="kawaii-mono-tag">your numbers</h2>
        <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
          {stats
            ? `${stats.connectorsConnected} sources · last sync ${formatRelative(stats.lastSyncAt)}`
            : error
              ? "stats unavailable"
              : "loading…"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(stats ? rowsFor(stats) : Array.from<StatRow | null>({ length: 4 }).fill(null)).map(
          (s, i) =>
            s ? (
              <div key={s.id} className="sticker-pop" style={{ animationDelay: `${i * 80}ms` }}>
                <CuteStat
                  label={s.label}
                  value={s.value}
                  sub={s.sub}
                  accent={s.accent}
                  tone={s.tone}
                />
              </div>
            ) : (
              <div key={i} className="sticker-pop" style={{ animationDelay: `${i * 80}ms` }}>
                <CuteStat label="loading" value="—" sub=" " tone="paper" />
              </div>
            ),
        )}
      </div>
    </section>
  );
}
