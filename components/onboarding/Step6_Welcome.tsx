"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StepProps } from "./OnboardingShell";

const STATS = [
  { id: "people", label: "People resolved", value: 863, prefix: "", suffix: "" },
  { id: "donations", label: "Donations indexed", value: 2437, prefix: "", suffix: "" },
  { id: "dollars", label: "Lifetime giving", value: 5198052, prefix: "$", suffix: "" },
  { id: "grants", label: "Grants tracked", value: 38, prefix: "", suffix: "" },
  { id: "programs", label: "Programs covered", value: 6, prefix: "", suffix: "" },
];

export function Step6Welcome({ state, back }: StepProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { gsap } = await import("gsap");
      if (!alive || !rootRef.current) return;
      // Animate stat cards rising in.
      gsap.fromTo(
        rootRef.current.querySelectorAll(".stat-card"),
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.1, delay: 0.2 },
      );
      // Animate counter for each stat.
      const cards = rootRef.current.querySelectorAll<HTMLElement>("[data-stat-value]");
      cards.forEach(el => {
        const target = parseInt(el.dataset.statValue ?? "0", 10);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 2.4,
          ease: "power2.out",
          delay: 0.4,
          onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString(); },
        });
      });
    })();
    return () => { alive = false; };
  }, []);

  const finalize = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `complete ${res.status}`);
      }
      const data = await res.json();
      router.push(data.redirectTo ?? "/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "could not finalize");
      setBusy(false);
    }
  };

  const orgName = state.tenant?.name ?? "your nonprofit";
  const uploadCount = state.uploads?.length ?? 0;
  const connectedCount = state.connectedConnectors?.length ?? state.selectedConnectors?.length ?? 0;

  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          building your knowledge graph
        </span>
        <h1 className="r-display text-[44px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[64px]">
          {orgName} is{" "}
          <span className="r-italic font-light text-[var(--matcha-mid)]">indexed.</span>
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-[var(--matcha-deep)]/70">
          {connectedCount} sources connected{uploadCount > 0 ? ` · ${uploadCount} files ingested` : ""}.
          Your team can now ask questions across every record. Citations link back to source.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {STATS.map(s => (
          <div key={s.id} className="stat-card rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] px-3 py-3">
            <div className="font-display text-[24px] font-medium tabular-nums leading-none text-[var(--matcha-deep)] sm:text-[28px]">
              {s.prefix}<span data-stat-value={s.value}>0</span>{s.suffix}
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-[var(--mint-line)] bg-[var(--mint-pale)]/30 px-4 py-3 text-[12px] leading-relaxed text-[var(--matcha-deep)]/70">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
          what's next
        </span>
        <p className="mt-1">
          Land on your dashboard for a snapshot of {orgName}'s health. From there, jump into chat and try one of our suggested questions — "who should I call this week?", "what grants close in 30 days?", "where's my cash?".
        </p>
      </div>

      {error && (
        <div className="rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 px-3 py-2 text-[13px] text-[var(--strawberry-deep)]">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]"
        >
          ← back
        </button>
        <button
          type="button"
          onClick={finalize}
          disabled={busy}
          className="rounded bg-[var(--strawberry-deep)] px-6 py-3 font-mono text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? "finalizing…" : "go to dashboard →"}
        </button>
      </div>
    </div>
  );
}
