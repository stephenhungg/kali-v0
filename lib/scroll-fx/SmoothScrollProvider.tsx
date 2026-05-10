"use client";

// SmoothScrollProvider — Lenis-backed smooth scroll for the whole page.
//
// Premium GSAP ScrollSmoother is paid; Lenis is the free equivalent and
// integrates cleanly with ScrollTrigger via gsap.ticker.
//
// Mount this at the layout level once. It:
//   1. Boots Lenis with sensible defaults (mobile-friendly, RAF-driven).
//   2. Drives Lenis from gsap.ticker so ScrollTrigger stays in sync.
//   3. Walks the DOM for [data-speed] elements and wires lightweight
//      parallax via ScrollTrigger (the ScrollSmoother data-speed analog).
//
// What's NOT supported (vs ScrollSmoother premium):
//   - data-lag (per-element trail) — skipped, not worth the complexity.
//   - Programmatic .effects() API — use Parallax component directly.
//   - Mobile address-bar lock — Lenis handles most cases automatically.

import { useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

interface SmoothScrollProviderProps {
  children: ReactNode;
  // Lerp factor (0-1). Lower = smoother but more lag. Default 0.1 matches Lenis docs.
  lerp?: number;
  // Enable [data-speed] parallax wiring on mount. Default true.
  enableDataSpeed?: boolean;
}

export function SmoothScrollProvider({
  children,
  lerp = 0.1,
  enableDataSpeed = true,
}: SmoothScrollProviderProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp, smoothWheel: true });

    // Drive Lenis from GSAP's ticker so ScrollTrigger stays perfectly synced.
    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // ScrollTrigger needs to know that Lenis is the scroll source.
    lenis.on("scroll", ScrollTrigger.update);

    // [data-speed] parallax wiring — mirrors ScrollSmoother's data-speed.
    // speed=1 is no-op; speed<1 moves slower than scroll; speed>1 faster.
    const speedTriggers: ScrollTrigger[] = [];
    if (enableDataSpeed) {
      const targets = document.querySelectorAll<HTMLElement>("[data-speed]");
      targets.forEach((el) => {
        const speed = parseFloat(el.dataset.speed ?? "1");
        if (Number.isNaN(speed) || speed === 1) return;
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => {
            const offset = (self.progress - 0.5) * 100 * (1 - speed);
            gsap.set(el, { y: offset });
          },
        });
        speedTriggers.push(trigger);
      });
    }

    return () => {
      gsap.ticker.remove(tick);
      speedTriggers.forEach((t) => t.kill());
      lenis.destroy();
    };
  }, [lerp, enableDataSpeed]);

  return <>{children}</>;
}

export default SmoothScrollProvider;
