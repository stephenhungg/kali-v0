'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

/**
 * ScrollToViewGallery
 *
 * Each child carrying `data-item` (configurable via `itemSelector`) animates
 * into view as it enters the viewport. Uses ScrollTrigger.batch to stagger
 * reveals when multiple items cross the threshold in the same frame, giving
 * a cascade effect rather than firing all at once. SSR-safe (effects only
 * run via useGSAP in the client) and free of hardcoded colors.
 *
 * Inspired by the GSAP scroll-to-view-gallery scrub demo, but reframed as a
 * reusable per-item reveal so it composes with arbitrary children.
 */

export interface ScrollToViewGalleryProps {
  itemSelector?: string;
  stagger?: number;
  start?: string;
  className?: string;
  children: ReactNode;
}

export function ScrollToViewGallery({
  itemSelector = '[data-item]',
  stagger = 0.08,
  start = 'top 85%',
  className,
  children,
}: ScrollToViewGalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      gsap.registerPlugin(ScrollTrigger);

      const items = gsap.utils.toArray<HTMLElement>(itemSelector, root);
      if (items.length === 0) return;

      gsap.set(items, { autoAlpha: 0, y: 32, scale: 0.96 });

      const triggers = ScrollTrigger.batch(items, {
        start,
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            stagger,
            overwrite: 'auto',
          });
        },
      });

      return () => {
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: containerRef, dependencies: [itemSelector, stagger, start] },
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

export default ScrollToViewGallery;
