"use client";

import { useEffect, useRef, useState } from "react";

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
  value: number;
  prefix: string;
  suffix: string;
  decimals?: number;
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
    { id: "records", label: "records indexed", value: s.recordsIndexed, prefix: "", suffix: "" },
    { id: "donations", label: `donations · all time`, value: s.donations.count, prefix: "", suffix: "" },
    { id: "cash", label: `cash on hand · ${s.cashOnHand.bankAccountCount} accounts`, value: s.cashOnHand.totalUsd, prefix: "$", suffix: "" },
    { id: "grants", label: "grants in pipeline", value: s.grantsInPipeline.count, prefix: "", suffix: "" },
  ];
}

export function StatCards({ tenantName: _tenantName }: StatCardsProps) {
  void _tenantName;
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!stats || !rootRef.current) return;
    let cancelled = false;
    void (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current.querySelectorAll(".stat-card"),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 },
      );
      const cards = rootRef.current.querySelectorAll<HTMLElement>("[data-stat-value]");
      cards.forEach((el) => {
        const target = parseFloat(el.dataset.statValue ?? "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = Math.round(obj.v).toLocaleString();
          },
        });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stats]);

  return (
    <section ref={rootRef}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          your numbers
        </h2>
        <span className="font-mono text-[10px] text-[var(--gray-ink)]">
          {stats
            ? `${stats.connectorsConnected} sources · last sync ${formatRelative(stats.lastSyncAt)}`
            : error
              ? "stats unavailable"
              : "loading…"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(stats ? rowsFor(stats) : Array.from({ length: 4 })).map((s, i) => (
          <div key={s ? (s as StatRow).id : i} className="stat-card chat-card rounded p-4">
            <div className="font-display text-[28px] font-medium tabular-nums leading-none text-[var(--matcha-deep)]">
              {s ? (
                <>
                  {(s as StatRow).prefix}
                  <span data-stat-value={(s as StatRow).value}>0</span>
                  {(s as StatRow).suffix}
                </>
              ) : (
                <span className="opacity-30">—</span>
              )}
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
              {s ? (s as StatRow).label : "loading"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
