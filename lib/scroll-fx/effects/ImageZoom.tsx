'use client';

/**
 * ImageZoom
 *
 * Pinned + scrubbed image zoom. As the user scrolls through the section,
 * the image scales from `fromScale` to `toScale`. The section is pinned
 * for the duration of the scrub so the zoom feels like a cinematic push-in.
 *
 * Technique (ported from the GSAP ScrollTrigger image-zoom demo):
 *  - A wrapper section is the ScrollTrigger trigger, pinned with scrub.
 *  - The image inside scales linearly with scroll progress.
 *  - End distance is "+=150%" of viewport so the scrub feels deliberate.
 *
 * Note on next/image: we use a plain <img> here because next/image injects
 * its own wrapper + sizing styles that fight `transform: scale()` on the
 * actual <img>. If you need next/image optimization, wrap an <Image fill />
 * in a relatively-positioned container and target that container instead.
 */
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

export interface ImageZoomProps {
  src: string;
  alt: string;
  fromScale?: number;
  toScale?: number;
  className?: string;
}

export function ImageZoom({
  src,
  alt,
  fromScale = 0.6,
  toScale = 1.2,
  className,
}: ImageZoomProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const img = imgRef.current;
      if (!section || !img) return;

      gsap.registerPlugin(ScrollTrigger);

      const tween = gsap.fromTo(
        img,
        { scale: fromScale, transformOrigin: 'center center' },
        {
          scale: toScale,
          ease: 'power1.inOut',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=150%',
            pin: true,
            scrub: true,
          },
        },
      );

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: sectionRef, dependencies: [fromScale, toScale] },
  );

  return (
    <section
      ref={sectionRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          willChange: 'transform',
        }}
      />
    </section>
  );
}

export default ImageZoom;
