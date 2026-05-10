/**
 * Sticker wordmark for "kali". Chunky lowercase letters with a thick white
 * keyline + offset green shadow + slight rotation. A tiny matcha sprout
 * sits on the i-dot. Inline SVG so it renders identically at any size
 * with no PNG roundtrip.
 *
 * Use this on every header. Don't redraw the wordmark per surface.
 */

import type { CSSProperties } from "react";

export interface StickerLogoProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Hide the sprout on the i-dot for a flatter logo. Default: true.
   * The prop is named `showStrawberry` for backward compatibility with
   * the strawberry era — it now controls the sprout. */
  showStrawberry?: boolean;
  /** Slight rotation so the logo feels hand-placed. Default: -2 deg. */
  tiltDeg?: number;
}

export function StickerLogo({
  size = 110,
  className,
  style,
  showStrawberry = true,
  tiltDeg = -2,
}: StickerLogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size * 0.46,
        transform: `rotate(${tiltDeg}deg)`,
        filter: "drop-shadow(2px 3px 0 var(--sticker-shadow))",
        ...style,
      }}
    >
      <svg viewBox="0 0 220 100" width="100%" height="100%" aria-label="kali">
        {/* keyline pass — fat white outline drawn first */}
        <text
          x="14"
          y="76"
          fontSize="86"
          fontWeight={800}
          fontFamily='var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif'
          letterSpacing="-2"
          fill="white"
          stroke="white"
          strokeWidth={14}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          kali
        </text>
        {/* shadow pass — offset deeper green */}
        <text
          x="17"
          y="79"
          fontSize="86"
          fontWeight={800}
          fontFamily='var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif'
          letterSpacing="-2"
          fill="var(--matcha-deep-warm, #2F5C3C)"
          opacity={0.45}
        >
          kali
        </text>
        {/* main pass — matcha green on top */}
        <text
          x="14"
          y="76"
          fontSize="86"
          fontWeight={800}
          fontFamily='var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif'
          letterSpacing="-2"
          fill="var(--sakura, #5FA374)"
        >
          kali
        </text>

        {showStrawberry && (
          <g transform="translate(151 22)">
            {/* matcha sprout dot — round dome with two small leaves */}
            <circle
              cx="0"
              cy="3"
              r="9"
              fill="#6FAB75"
              stroke="white"
              strokeWidth={3}
            />
            {/* lighter mint highlight */}
            <ellipse cx="-2" cy="1" rx="3" ry="2" fill="#9FCFA7" opacity="0.7" />
            {/* two leaf tips poking up */}
            <path
              d="M -4 -5 Q -7 -11 -1 -10 Q 0 -6 -4 -5 Z"
              fill="#2F5C3C"
              stroke="white"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <path
              d="M 4 -5 Q 7 -11 1 -10 Q 0 -6 4 -5 Z"
              fill="#2F5C3C"
              stroke="white"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
    </span>
  );
}
