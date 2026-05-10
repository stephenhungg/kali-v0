"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

/**
 * Hero display with GSAP entrance animation. The headline splits into words,
 * each word's letters stagger-rise from below with a soft blur. The eyebrow
 * line fades + slides in first, the headline cascades, then the body + CTAs
 * fade up. Runs once on mount.
 */
export function HeroDisplay() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero-eyebrow]", { y: 12, opacity: 0, duration: 0.6 })
        .from(
          "[data-hero-line] .word",
          {
            yPercent: 110,
            opacity: 0,
            rotateX: -45,
            duration: 1.0,
            stagger: 0.07,
          },
          "-=0.2",
        )
        .from(
          "[data-hero-body]",
          { y: 16, opacity: 0, duration: 0.6 },
          "-=0.5",
        )
        .from(
          "[data-hero-cta]",
          { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 },
          "-=0.4",
        );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28"
    >
      <div
        data-hero-eyebrow
        className="mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400"
      >
        <span className="inline-block h-1.5 w-1.5 bg-[#cbf478]" />
        kali — for nonprofits — hackdavis 2026
      </div>

      <h1 className="kali-display font-display text-[18vw] font-semibold leading-[0.92] tracking-tighter text-white sm:text-[15vw] md:text-[170px] lg:text-[200px]">
        <Line>
          <Word>creating</Word>
        </Line>
        <Line>
          <Word className="text-[#cbf478]">all</Word>{" "}
          <Word className="text-[#cbf478]">things</Word>
          <Word className="text-[#cbf478] kali-mark"> </Word>
        </Line>
        <Line>
          <Word className="text-zinc-500">nonprofits.</Word>
        </Line>
      </h1>

      <div className="mt-12 grid grid-cols-1 items-end gap-10 md:grid-cols-2">
        <p
          data-hero-body
          className="max-w-xl text-balance text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          one chat across <span className="text-white">eleven SaaS tools</span>{" "}
          and onchain payouts on solana. ask in plain english, get an answer
          with citations. no more spreadsheet archaeology.
        </p>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <a
            data-hero-cta
            href="#queries"
            className="inline-flex items-center gap-2 bg-[#cbf478] px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-transform hover:scale-[1.02]"
          >
            see the demo →
          </a>
          <a
            data-hero-cta
            href="https://github.com/stephenhungg/kali-v0"
            className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white hover:text-white"
          >
            github
          </a>
        </div>
      </div>
    </section>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <span data-hero-line className="block overflow-hidden pb-1.5">
      {children}
    </span>
  );
}

function Word({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`word inline-block ${className ?? ""}`}>{children}</span>
  );
}
