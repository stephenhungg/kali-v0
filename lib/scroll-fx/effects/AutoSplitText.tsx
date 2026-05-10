'use client';

/**
 * AutoSplitText
 * -------------
 * Reveals text word-by-word (or char-by-char) as it scrolls into view.
 *
 * How it works (for the curious):
 * 1. We take the `children` string and split it into words/chars.
 * 2. Each piece gets wrapped in a <span> with `display:inline-block` so we
 *    can transform it (translateY, opacity) without breaking text layout.
 * 3. GSAP animates those spans on a ScrollTrigger that fires once when the
 *    element hits 80% down the viewport.
 *
 * We avoid GSAP's premium SplitText plugin (paid) by doing the split inline.
 * useGSAP handles cleanup so ScrollTriggers don't leak between renders.
 */

import { useRef, createElement } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span';
type SplitMode = 'words' | 'chars';

export interface AutoSplitTextProps {
  as?: Tag;
  split?: SplitMode;
  stagger?: number;
  duration?: number;
  className?: string;
  children: string;
}

export function AutoSplitText({
  as = 'p',
  split = 'words',
  stagger = 0.05,
  duration = 0.8,
  className,
  children,
}: AutoSplitTextProps) {
  const ref = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const pieces = ref.current.querySelectorAll<HTMLSpanElement>('[data-split-piece]');
      if (pieces.length === 0) return;

      gsap.fromTo(
        pieces,
        { yPercent: 100, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 80%',
            once: true,
          },
        },
      );
    },
    { scope: ref, dependencies: [children, split, stagger, duration] },
  );

  const tokens = split === 'chars' ? Array.from(children) : children.split(/(\s+)/);
  const nodes = tokens.map((tok, i) => {
    if (/^\s+$/.test(tok)) return tok;
    return createElement(
      'span',
      {
        key: i,
        'data-split-piece': true,
        style: { display: 'inline-block', willChange: 'transform, opacity' },
      },
      tok,
    );
  });

  return createElement(
    as,
    { ref, className, style: { overflow: 'hidden' } },
    ...nodes,
  );
}

export default AutoSplitText;
