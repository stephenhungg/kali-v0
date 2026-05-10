"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Stagger-reveals direct children as they scroll into view. Mark children to
 * stagger by giving them `data-reveal`. Other children are passed through
 * untouched. Use it on grids, query lists, stat rows.
 */
export function RevealStack({
  children,
  className,
  yFrom = 24,
  stagger = 0.08,
  duration = 0.7,
}: {
  children: React.ReactNode;
  className?: string;
  yFrom?: number;
  stagger?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = el.querySelectorAll("[data-reveal]");
      if (!targets.length) return;
      gsap.from(targets, {
        y: yFrom,
        opacity: 0,
        duration,
        stagger,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
