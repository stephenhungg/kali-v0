"use client";

// SSR-safe one-time registration of the ScrollTrigger plugin.
// Call useScrollTrigger() at the top of any component that uses ScrollTrigger
// to guarantee the plugin is registered before any animations run.

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function useScrollTrigger(): void {
  useEffect(() => {
    if (registered) return;
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }, []);
}
