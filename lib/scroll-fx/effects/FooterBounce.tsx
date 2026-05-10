'use client';

/**
 * FooterBounce
 *
 * Wraps content (typically a footer) in a wrapper that squishes/bounces
 * proportional to the user's scroll velocity when the wrapper enters the
 * viewport. Faster scroll -> springier elastic settle.
 *
 * Original technique: GSAP MorphSVG demo (footer-bounce-based-on-scroll-speed)
 * — adapted here to a CSS-transform-only version (no SVG morph dep). We read
 * `ScrollTrigger.getVelocity()` on enter, derive a normalized variation,
 * then animate scaleY/translateY back to rest with `elastic.out` whose
 * amplitude + period are driven by that velocity.
 *
 * `intensity` scales the velocity response. 0 disables the effect entirely
 * (children render straight through, no GSAP work).
 */
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

export interface FooterBounceProps {
  intensity?: number;
  className?: string;
  children: ReactNode;
}

export function FooterBounce({
  intensity = 1,
  className,
  children,
}: FooterBounceProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || intensity === 0) return;

      gsap.registerPlugin(ScrollTrigger);

      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        onEnter: (self) => {
          const velocity = self.getVelocity();
          const variation = gsap.utils.clamp(-0.6, 0.6, (velocity / 10000) * intensity);
          const squish = gsap.utils.clamp(-0.4, 0.4, (velocity / 6000) * intensity);

          gsap.fromTo(
            el,
            { scaleY: 1 + squish, y: -squish * 80, transformOrigin: 'bottom center' },
            {
              scaleY: 1,
              y: 0,
              duration: 2,
              ease: `elastic.out(${1 + Math.abs(variation)}, ${Math.max(0.15, 1 - Math.abs(variation))})`,
              overwrite: true,
            },
          );
        },
      });

      return () => {
        trigger.kill();
      };
    },
    { scope: ref, dependencies: [intensity] },
  );

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: 'transform', transformOrigin: 'bottom center' }}
    >
      {children}
    </div>
  );
}

export default FooterBounce;
