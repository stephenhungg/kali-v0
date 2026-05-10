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
    <div ref={ref} className="border border-white/10 bg-[#0e1011] p-7 sm:p-10">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        <span className="inline-block h-1.5 w-1.5 bg-[#cbf478]" />
        live · cross-tool reasoning
      </div>

      <Typewriter text={QUERY} active={inView} />

      <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
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
    <p className="mt-4 font-display text-2xl text-white sm:text-3xl">
      <span className="text-[#cbf478]">&gt; </span>
      {text.slice(0, shown)}
      <span className="ml-1 inline-block h-6 w-[3px] animate-pulse bg-white align-middle sm:h-7" />
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
      initial={{ opacity: 0, y: 8 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ delay: 1.6 + index * 0.05, duration: 0.4 }}
      className="relative"
    >
      <div
        className={[
          "border px-3 py-2.5 text-[11px] transition-all duration-500",
          isHit
            ? "border-[#cbf478] bg-[#cbf478]/[0.08] text-white"
            : "border-white/10 bg-white/[0.02] text-zinc-500",
        ].join(" ")}
      >
        <div className="font-medium">{source.label}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-600">
          {source.domain}
        </div>
        {isHit && active && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.4 + index * 0.05, type: "spring" }}
            className="absolute right-2 top-2 inline-block h-1.5 w-1.5 bg-[#cbf478] shadow-[0_0_10px_#cbf478]"
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
      className="mt-8 border border-white/10 bg-black/40 p-5 font-mono text-sm leading-relaxed text-zinc-300"
    >
      <span className="text-[#cbf478]">kali ·</span>{" "}
      <span className="text-white">14 lapsed donors</span> with employer
      matching available. avg lapsed value{" "}
      <span className="text-white">$3,210</span>. top employer:{" "}
      <span className="text-white">Patel Industries</span>.{" "}
      <span className="text-zinc-500">cited from bloomerang, salesforce, m365.</span>
    </motion.div>
  );
}
