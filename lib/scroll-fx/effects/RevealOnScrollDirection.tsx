'use client';

/**
 * RevealOnScrollDirection
 *
 * Direction-aware reveal: the element animates in from a different side
 * depending on whether the user is scrolling DOWN or UP when it enters
 * the viewport.
 *
 * Technique (ported from the GSAP ScrollTrigger demo):
 *  - Hide the element initially (autoAlpha: 0).
 *  - Create a ScrollTrigger; on `onEnter` animate from `+distance` along the
 *    axis (the element rises from below — user is scrolling down).
 *  - On `onEnterBack` animate from `-distance` (the element drops from above —
 *    user is scrolling up).
 *  - On `onLeave` re-hide so the next direction-aware entry replays cleanly.
 *  - For 'left'/'right' the axis flips to X and direction is fixed.
 */
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

export type RevealFrom = 'down' | 'up' | 'left' | 'right';

export interface RevealOnScrollDirectionProps {
  from?: RevealFrom;
  distance?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}

export function RevealOnScrollDirection({
  from = 'down',
  distance = 100,
  duration = 1.25,
  className,
  children,
}: RevealOnScrollDirectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      gsap.registerPlugin(ScrollTrigger);

      const horizontal = from === 'left' || from === 'right';
      const baseOffset =
        from === 'left' ? -distance : from === 'right' ? distance : from === 'up' ? -distance : distance;

      const animateFrom = (dir: 1 | -1): void => {
        const x = horizontal ? baseOffset : 0;
        const y = horizontal ? 0 : dir * distance;
        gsap.fromTo(
          el,
          { x, y, autoAlpha: 0 },
          { x: 0, y: 0, autoAlpha: 1, duration, ease: 'expo', overwrite: 'auto' },
        );
      };

      const hide = (): void => {
        gsap.set(el, { autoAlpha: 0 });
      };

      hide();

      const trigger = ScrollTrigger.create({
        trigger: el,
        onEnter: () => animateFrom(horizontal ? 1 : from === 'up' ? -1 : 1),
        onEnterBack: () => animateFrom(horizontal ? 1 : from === 'up' ? 1 : -1),
        onLeave: hide,
      });

      return () => {
        trigger.kill();
      };
    },
    { scope: ref, dependencies: [from, distance, duration] },
  );

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform, opacity' }}>
      {children}
    </div>
  );
}

export default RevealOnScrollDirection;
