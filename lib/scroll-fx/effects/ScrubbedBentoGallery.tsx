'use client';

/*
 * ScrubbedBentoGallery — Flip-driven bento layout tied to scroll.
 *
 * Ported from the GSAP "scrubbed-bento-gallery" demo (Flip + ScrollTrigger).
 * Pattern: capture the cells' final layout state by temporarily applying a
 * `gallery--final` class, then Flip.to() animates them FROM the initial bento
 * grid TO the expanded layout. The Flip tween is added to a timeline whose
 * scrollTrigger pins the gallery's parent and scrubs the animation against
 * scroll position.
 *
 * The consumer owns layout: provide two CSS rules — the default state for
 * `[data-bento-grid]` (the bento grid) and the expanded state for
 * `[data-bento-grid].is-final`. Cells are any descendants matching
 * `itemSelector` (default `[data-bento]`). No colors, sizing, or grid
 * templates are baked in.
 */

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

export interface ScrubbedBentoGalleryProps {
  scrub?: number;
  className?: string;
  itemSelector?: string;
  children: ReactNode;
}

export function ScrubbedBentoGallery({
  scrub = 1,
  className,
  itemSelector = '[data-bento]',
  children,
}: ScrubbedBentoGalleryProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger, Flip);

      const wrap = wrapRef.current;
      const grid = gridRef.current;
      if (!wrap || !grid) return;

      const items = grid.querySelectorAll<HTMLElement>(itemSelector);
      if (items.length === 0) return;

      grid.classList.remove('is-final');
      grid.classList.add('is-final');
      const flipState = Flip.getState(items);
      grid.classList.remove('is-final');

      const flip = Flip.to(flipState, {
        simple: true,
        ease: 'expoScale(1, 5)',
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: grid,
          start: 'center center',
          end: '+=100%',
          scrub,
          pin: wrap,
          invalidateOnRefresh: true,
        },
      });
      tl.add(flip);

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        gsap.set(items, { clearProps: 'all' });
      };
    },
    { scope: wrapRef, dependencies: [scrub, itemSelector] },
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden' }}>
      <div ref={gridRef} className={className} data-bento-grid>
        {children}
      </div>
    </div>
  );
}

export default ScrubbedBentoGallery;
