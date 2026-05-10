'use client';

/**
 * Parallax
 *
 * Element translates Y at a different rate than the page scroll, producing
 * a depth-of-field parallax. Driven by a ScrollTrigger with `scrub: true`
 * over the element's own scroll range (top-bottom -> bottom-top).
 *
 * Speed semantics:
 *   speed =  1   -> moves with the page (no parallax effect)
 *   speed =  0   -> appears pinned to the page (no movement)
 *   speed =  0.5 -> moves at half the scroll rate (classic background parallax)
 *   speed <  0   -> moves opposite to scroll (foreground rises faster than page)
 *
 * Internally we translate by `(1 - speed) * distance` across the trigger range:
 * a fully-pinned element (speed 0) traverses the full `distance`, a "scrolls
 * with page" element (speed 1) traverses 0px.
 */
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

export interface ParallaxProps {
  speed?: number;
  distance?: number;
  className?: string;
  children: ReactNode;
}

export function Parallax({
  speed = 0.5,
  distance = 100,
  className,
  children,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      gsap.registerPlugin(ScrollTrigger);

      const travel = (1 - speed) * distance;

      const tween = gsap.to(el, {
        y: -travel,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: ref, dependencies: [speed, distance] },
  );

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

export default Parallax;
