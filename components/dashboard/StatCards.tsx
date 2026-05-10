"use client";

import { useEffect, useRef } from "react";

interface StatCardsProps {
  tenantName: string;
}

const STATS = [
  { id: "records", label: "Records indexed", value: 5575, prefix: "", suffix: "" },
  { id: "donations", label: "Donations YTD", value: 2437, prefix: "", suffix: "" },
  { id: "cash", label: "Cash on hand", value: 1248000, prefix: "$", suffix: "" },
  { id: "grants", label: "Grants in pipeline", value: 17, prefix: "", suffix: "" },
];

export function StatCards({ tenantName }: StatCardsProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { gsap } = await import("gsap");
      if (!alive || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current.querySelectorAll(".stat-card"),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 },
      );
      const cards = rootRef.current.querySelectorAll<HTMLElement>("[data-stat-value]");
      cards.forEach(el => {
        const target = parseInt(el.dataset.statValue ?? "0", 10);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString(); },
        });
      });
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section ref={rootRef}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          your numbers
        </h2>
        <span className="font-mono text-[10px] text-[var(--gray-ink)]">
          last sync · just now
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map(s => (
          <div
            key={s.id}
            className="stat-card chat-card rounded p-4"
          >
            <div className="font-display text-[28px] font-medium tabular-nums leading-none text-[var(--matcha-deep)]">
              {s.prefix}<span data-stat-value={s.value}>0</span>{s.suffix}
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
