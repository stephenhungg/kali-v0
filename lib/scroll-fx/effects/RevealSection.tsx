'use client';

/**
 * RevealSection
 *
 * Full-screen section slideshow driven by GSAP Observer (NOT ScrollTrigger).
 * Each wheel tick / touch swipe / pointer drag advances or reverses one
 * section. Sections are stacked absolutely on top of each other; only one is
 * visible at a time and an animated transition plays between them.
 *
 * Ported from: https://codepen.io/GreenSock/pen/animated-continuous-sections-with-gsap-observer
 *
 * Technique:
 *  - Observer.create({ type: 'wheel,touch,pointer', wheelSpeed: -1, ... }) —
 *    onUp = next section, onDown = previous section.
 *  - preventDefault: true means the browser's normal scroll is suppressed
 *    while the pointer is over the component. The `animating` guard drops
 *    extra ticks while a transition is in flight.
 *  - Three transition styles:
 *      'cover' — outgoing section parallax-shifts out, incoming section
 *                wipes in via stacked outer/inner wrappers (GSAP demo style).
 *      'slide' — incoming section translates in from above/below.
 *      'fade'  — simple opacity crossfade.
 *
 * CAVEAT FOR CONSUMERS:
 *   This component scroll-jacks the page. While the user's pointer is over
 *   it, normal vertical scrolling is intercepted and converted into section
 *   navigation. Do NOT mount it inside a normally-scrolling page — give it
 *   its own route, or a fixed-viewport container, or expect confused users.
 */

import { useRef, type ReactNode, type CSSProperties } from 'react';
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { useGSAP } from '@gsap/react';

export type RevealSectionAnimation = 'fade' | 'slide' | 'cover';

export interface RevealSectionProps {
  sections: ReactNode[];
  className?: string;
  sectionClassName?: string;
  animation?: RevealSectionAnimation;
}

export function RevealSection({
  sections,
  className,
  sectionClassName,
  animation = 'cover',
}: RevealSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;
      if (sections.length === 0) return;

      gsap.registerPlugin(Observer);

      const sectionEls = gsap.utils.toArray<HTMLElement>(root.querySelectorAll<HTMLElement>('[data-reveal-section]'));
      const outerEls = gsap.utils.toArray<HTMLElement>(root.querySelectorAll<HTMLElement>('[data-reveal-outer]'));
      const innerEls = gsap.utils.toArray<HTMLElement>(root.querySelectorAll<HTMLElement>('[data-reveal-inner]'));

      const wrap = gsap.utils.wrap(0, sectionEls.length);
      let currentIndex = -1;
      let animating = false;

      // Initial state per animation mode
      gsap.set(sectionEls, { autoAlpha: 0, zIndex: 0 });
      if (animation === 'cover') {
        gsap.set(outerEls, { yPercent: 100 });
        gsap.set(innerEls, { yPercent: -100 });
      }

      const gotoSection = (rawIndex: number, direction: 1 | -1): void => {
        const index = wrap(rawIndex);
        animating = true;
        const dFactor = direction === -1 ? -1 : 1;
        const tl = gsap.timeline({
          defaults: { duration: 1.25, ease: 'power1.inOut' },
          onComplete: () => {
            animating = false;
          },
        });

        if (currentIndex >= 0 && currentIndex !== index) {
          const prev = sectionEls[currentIndex];
          gsap.set(prev, { zIndex: 0 });
          if (animation === 'fade') {
            tl.to(prev, { autoAlpha: 0 }, 0);
          } else if (animation === 'slide') {
            tl.to(prev, { yPercent: -100 * dFactor, autoAlpha: 1 }, 0).set(prev, {
              autoAlpha: 0,
              yPercent: 0,
            });
          } else {
            // cover — leave outgoing visible underneath; hide at end
            tl.set(prev, { autoAlpha: 1 }).to({}, { duration: 0.001 }, 0).set(prev, { autoAlpha: 0 }, 1.0);
          }
        }

        const next = sectionEls[index];
        gsap.set(next, { autoAlpha: 1, zIndex: 1 });

        if (animation === 'fade') {
          tl.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1 }, 0);
        } else if (animation === 'slide') {
          tl.fromTo(next, { yPercent: 100 * dFactor, autoAlpha: 1 }, { yPercent: 0 }, 0);
        } else {
          // cover — outer slides up from below (or down from above), inner counter-slides
          const outer = outerEls[index];
          const inner = innerEls[index];
          if (outer && inner) {
            tl.fromTo(
              [outer, inner],
              { yPercent: (i: number) => (i ? -100 * dFactor : 100 * dFactor) },
              { yPercent: 0 },
              0,
            );
          }
        }

        currentIndex = index;
      };

      const observer = Observer.create({
        target: root,
        type: 'wheel,touch,pointer',
        wheelSpeed: -1,
        tolerance: 10,
        preventDefault: true,
        onDown: () => {
          if (!animating) gotoSection(currentIndex - 1, -1);
        },
        onUp: () => {
          if (!animating) gotoSection(currentIndex + 1, 1);
        },
      });

      gotoSection(0, 1);

      return () => {
        observer.kill();
      };
    },
    { scope: containerRef, dependencies: [animation, sections.length] },
  );

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  const sectionStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    visibility: 'hidden',
  };

  const wrapperStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  return (
    <div ref={containerRef} className={className} style={rootStyle}>
      {sections.map((node, i) => (
        <section
          key={i}
          data-reveal-section
          className={sectionClassName}
          style={sectionStyle}
        >
          {animation === 'cover' ? (
            <div data-reveal-outer style={wrapperStyle}>
              <div data-reveal-inner style={wrapperStyle}>
                {node}
              </div>
            </div>
          ) : (
            node
          )}
        </section>
      ))}
    </div>
  );
}

export default RevealSection;
