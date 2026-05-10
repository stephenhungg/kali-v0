'use client';

/*
 * HorizontalGallery — pinned horizontal scroll section.
 *
 * Ported from the GSAP "horizontal-scrolling-gallery + ScrollTrigger" demo.
 * Pattern: pin the outer <section>, translate the inner <track> on the X axis
 * as the user scrolls vertically. Distance is computed from
 * `track.scrollWidth - viewport width` and refreshed on resize via
 * invalidateOnRefresh, so children can be any width the consumer chooses.
 *
 * Layout-only structural styles are inline (flex track, overflow hidden).
 * Colors, sizing, gaps, and item styling are the consumer's responsibility.
 */

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

export interface HorizontalGalleryProps {
  scrub?: boolean | number;
  end?: string;
  className?: string;
  trackClassName?: string;
  children: ReactNode;
}

export function HorizontalGallery({
  scrub = true,
  end = '+=300%',
  className,
  trackClassName,
  children,
}: HorizontalGalleryProps) {
  const pinRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      const section = pinRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const getDistance = (): number =>
        Math.max(0, track.scrollWidth - window.innerWidth);

      const tween = gsap.to(track, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          pin: section,
          scrub,
          start: 'top top',
          end,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: pinRef, dependencies: [scrub, end] },
  );

  return (
    <section
      ref={pinRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div
        ref={trackRef}
        className={trackClassName}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default HorizontalGallery;
