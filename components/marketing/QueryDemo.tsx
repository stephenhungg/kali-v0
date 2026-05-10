"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const QUERY = "find lapsed donors with active matching gifts at their employer";
const SOURCES = [
  { id: "bloomerang", label: "bloomerang", domain: "donor" },
  { id: "salesforce", label: "salesforce", domain: "donor" },
  { id: "m365", label: "m365", domain: "comms" },
  { id: "instrumentl", label: "instrumentl", domain: "grants" },
  { id: "quickbooks", label: "quickbooks", domain: "finance" },
  { id: "sharepoint", label: "sharepoint", domain: "programs" },
  { id: "zoom", label: "zoom", domain: "comms" },
  { id: "powerautomate", label: "power automate", domain: "programs" },
  { id: "powerbi", label: "power bi", domain: "analytics" },
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
      className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-6 backdrop-blur-sm sm:p-8"
    >
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        live demo · cross-tool reasoning
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
    <p className="mt-3 font-mono text-base text-zinc-200 sm:text-lg">
      <span className="text-zinc-500">&gt; </span>
      {text.slice(0, shown)}
      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-zinc-300 align-middle" />
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
          "rounded-lg border px-3 py-2.5 text-[11px] transition-all duration-500",
          isHit
            ? "border-emerald-400/40 bg-emerald-400/[0.04] text-zinc-100"
            : "border-white/[0.06] bg-white/[0.02] text-zinc-500",
        ].join(" ")}
      >
        <div className="font-mono">{source.label}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
          {source.domain}
        </div>
        {isHit && active && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.4 + index * 0.05, type: "spring" }}
            className="absolute right-2 top-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
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
      className="mt-8 rounded-lg border border-white/[0.06] bg-black/40 p-4 font-mono text-sm leading-relaxed text-zinc-300"
    >
      <span className="text-zinc-500">kali · </span>
      14 lapsed donors with employer matching available. avg lapsed value{" "}
      <span className="text-zinc-100">$3,210</span>. top employer:{" "}
      <span className="text-zinc-100">Patel Industries</span>{" "}
      <span className="text-zinc-500">[bl-9821]</span>{" "}
      <span className="text-zinc-500">[003abc]</span>{" "}
      <span className="text-zinc-500">[m365-9f]</span>
    </motion.div>
  );
}
