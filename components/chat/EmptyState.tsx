"use client";

import { useEffect, useRef } from "react";

const PLAYBOOKS = [
  {
    label: "Who should I call this week?",
    sub: "donor outreach prioritization",
    detail: "Lapsed donors, recent engagement signals, matching-gift eligible.",
  },
  {
    label: "What grants close in the next 30 days?",
    sub: "grant pipeline triage",
    detail: "Deadlines + fit scores + funder ties from the board.",
  },
  {
    label: "Show me lapsed donors with matching gifts",
    sub: "the wow query — 3 connectors",
    detail: "Bloomerang × Salesforce × M365 — last contact + employer match.",
  },
  {
    label: "Where's my cash, am I gonna make payroll?",
    sub: "finance × programs cross-check",
    detail: "Cash position + 90-day runway + at-risk program flags.",
  },
];

interface EmptyStateProps {
  onPick: (prompt: string) => void;
}

export function EmptyState({ onPick }: EmptyStateProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { gsap } = await import("gsap");
      if (!mounted || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current.querySelectorAll(".pb-row"),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08, delay: 0.1 },
      );
      gsap.fromTo(
        rootRef.current.querySelectorAll(".pb-head"),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.05 },
      );
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div ref={rootRef} className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-2">
        <span className="pb-head font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          ask kali · cited answers across your nonprofit stack
        </span>
        <h1 className="pb-head r-display text-[44px] leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[64px]">
          What do you want to know{" "}
          <span className="r-italic font-light text-[var(--matcha-mid)]">today?</span>
        </h1>
        <p className="pb-head max-w-xl text-[15px] leading-relaxed text-[var(--matcha-deep)]/70">
          Pick a starting question or type your own. Every answer is cited back to the
          source record — donors, grants, emails, transcripts, txns. No black boxes.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {PLAYBOOKS.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick(p.label)}
            className="pb-row group flex flex-col items-start gap-1 rounded border border-[var(--mint-line)] bg-[var(--surface)] px-4 py-3.5 text-left transition-all hover:border-[var(--matcha-mid)] hover:bg-[var(--mint-pale)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex flex-col">
              <span className="text-[15px] font-medium text-[var(--matcha-deep)] sm:text-[16px]">
                {p.label}
              </span>
              <span className="hidden text-[12px] leading-snug text-[var(--gray-ink)] sm:inline">
                {p.detail}
              </span>
            </div>
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)] group-hover:text-[var(--matcha-mid)]">
              <span className="hidden sm:inline">{p.sub}</span>
              <span className="text-[14px]">→</span>
            </span>
          </button>
        ))}
      </div>

      <div className="rounded border border-dashed border-[var(--mint-line)] bg-[var(--mint-pale)]/30 px-4 py-3 text-[12px] leading-relaxed text-[var(--matcha-deep)]/70">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
          how this works
        </span>
        <p className="mt-1">
          Kali calls real tools across your connected systems and shows you the work — every
          tool firing, every record it cited. The right panel is the receipt. The left panel
          pulses as sources get hit.
        </p>
      </div>
    </div>
  );
}
