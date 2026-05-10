"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const QUERY = "find lapsed donors with active matching gifts at their employer";
const SOURCES = [
  { id: "bloomerang", label: "bloomerang", domain: "donors" },
  { id: "salesforce", label: "salesforce", domain: "crm" },
  { id: "m365", label: "microsoft 365", domain: "email" },
  { id: "instrumentl", label: "instrumentl", domain: "grants" },
  { id: "quickbooks", label: "quickbooks", domain: "finance" },
  { id: "sharepoint", label: "sharepoint", domain: "docs" },
  { id: "zoom", label: "zoom", domain: "meetings" },
  { id: "powerautomate", label: "power automate", domain: "workflows" },
  { id: "powerbi", label: "power bi", domain: "reports" },
  { id: "knowbe4", label: "knowbe4", domain: "security" },
  { id: "solana", label: "solana", domain: "payouts" },
] as const;

const HIT = new Set(["bloomerang", "salesforce", "m365"]);

export function QueryDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div
      ref={ref}
      className="rounded-3xl border border-amber-900/10 bg-white/70 p-7 shadow-sm shadow-amber-900/5 backdrop-blur sm:p-9"
    >
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-amber-900/50">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
        a real query · live across 11 tools
      </div>

      <Typewriter text={QUERY} active={inView} />

      <div className="mt-7 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {SOURCES.map((s, i) => (
          <SourceTile key={s.id} source={s} index={i} active={inView} />
        ))}
      </div>

      <AnswerBlock active={inView} />
    </div>
  );
}

function Typewriter({ text, active }: { text: string; active: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 32);
    return () => clearTimeout(t);
  }, [active, shown, text.length]);

  return (
    <p className="mt-3 font-serif text-lg italic text-stone-800 sm:text-xl">
      <span className="not-italic text-stone-400">“ </span>
      {text.slice(0, shown)}
      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-stone-500 align-middle" />
    </p>
  );
}

function SourceTile({
  source,
  index,
  active,
}: {
  source: { id: string; label: string; domain: string };
  index: number;
  active: boolean;
}) {
  const isHit = HIT.has(source.id);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ delay: 1.6 + index * 0.05, duration: 0.4 }}
      className="relative"
    >
      <div
        className={[
          "rounded-xl border px-3 py-2.5 text-[11px] transition-all duration-500",
          isHit
            ? "border-emerald-500/30 bg-emerald-50/80 text-stone-800"
            : "border-stone-200 bg-stone-50/60 text-stone-500",
        ].join(" ")}
      >
        <div className="font-medium">{source.label}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-stone-400">
          {source.domain}
        </div>
        {isHit && active && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.4 + index * 0.05, type: "spring" }}
            className="absolute right-2 top-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          />
        )}
      </div>
    </motion.div>
  );
}

function AnswerBlock({ active }: { active: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={active ? { opacity: 1 } : { opacity: 0 }}
      transition={{ delay: 3.2, duration: 0.6 }}
      className="mt-7 rounded-2xl bg-stone-50/70 p-5 text-sm leading-relaxed text-stone-700"
    >
      <span className="font-mono text-[11px] uppercase tracking-widest text-amber-900/40">
        kali ·
      </span>{" "}
      <span className="text-stone-800">14 lapsed donors</span> with employer
      matching available. average lapsed value{" "}
      <span className="text-stone-800">$3,210</span>. top employer:{" "}
      <span className="text-stone-800">Patel Industries</span>.{" "}
      <span className="text-stone-400">cited from bloomerang, salesforce, m365.</span>
    </motion.div>
  );
}
