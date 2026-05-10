/**
 * Mini sticker props that scatter across the UI. 8 motifs. Always thick
 * white keyline + offset green shadow. Drawn inline so they're free.
 *
 * White + mint edition: every accent is a green / cream variant. Token
 * names are preserved (`strawberry`, `sakura`) so existing imports keep
 * working — they just render as mint-toned shapes now.
 */

import type { CSSProperties } from "react";

export type StickerProp =
  | "strawberry"
  | "matcha-bowl"
  | "sakura"
  | "sparkle"
  | "cloud"
  | "chart"
  | "coin"
  | "letter";

export interface StickerAccentProps {
  prop: StickerProp;
  size?: number;
  className?: string;
  style?: CSSProperties;
  tiltDeg?: number;
}

export function StickerAccent({
  prop,
  size = 36,
  className,
  style,
  tiltDeg = -6,
}: StickerAccentProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        transform: `rotate(${tiltDeg}deg)`,
        filter: "drop-shadow(1.5px 2px 0 var(--sticker-shadow))",
        ...style,
      }}
    >
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        {prop === "strawberry" && <MintMochi />}
        {prop === "matcha-bowl" && <MatchaBowl />}
        {prop === "sakura" && <CloverFlower />}
        {prop === "sparkle" && <Sparkle />}
        {prop === "cloud" && <Cloud />}
        {prop === "chart" && <Chart />}
        {prop === "coin" && <Coin />}
        {prop === "letter" && <Letter />}
      </svg>
    </span>
  );
}

/** Mint mochi — replaces the strawberry brand-mark, kept under the
 *  `strawberry` token name for backward compat with existing imports. */
function MintMochi() {
  return (
    <g>
      <ellipse
        cx="20"
        cy="24"
        rx="14"
        ry="12"
        fill="white"
        stroke="white"
        strokeWidth={3}
      />
      <ellipse cx="20" cy="24" rx="11" ry="9" fill="#DCEDDF" />
      {/* leaves on top */}
      <path
        d="M 12 12 L 20 4 L 28 12 Z"
        fill="#6FAB75"
        stroke="white"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <circle cx="14" cy="26" r="1.2" fill="#6FAB75" opacity="0.6" />
      <circle cx="22" cy="28" r="1.2" fill="#6FAB75" opacity="0.6" />
      <circle cx="18" cy="22" r="1.2" fill="#6FAB75" opacity="0.6" />
    </g>
  );
}

function MatchaBowl() {
  return (
    <g>
      {/* steam */}
      <path d="M 16 6 Q 18 2 16 0" stroke="#6FAB75" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M 24 6 Q 26 2 24 0" stroke="#6FAB75" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* bowl */}
      <path
        d="M 4 18 Q 4 34 20 34 Q 36 34 36 18 Z"
        fill="#FBFEFC"
        stroke="white"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* tea */}
      <ellipse cx="20" cy="18" rx="14" ry="3" fill="#6FAB75" />
      <ellipse cx="20" cy="18" rx="11" ry="2" fill="#2F5C3C" opacity={0.4} />
    </g>
  );
}

/** Four-leaf clover — replaces the sakura petal under the same token. */
function CloverFlower() {
  return (
    <g transform="translate(20 20)">
      {[0, 90, 180, 270].map((rot, i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-9"
          rx="6"
          ry="8"
          fill="#9FCFA7"
          stroke="white"
          strokeWidth={2}
          transform={`rotate(${rot})`}
        />
      ))}
      <circle cx="0" cy="0" r="3" fill="#6FAB75" stroke="white" strokeWidth={1.5} />
    </g>
  );
}

function Sparkle() {
  return (
    <g transform="translate(20 20)">
      <path
        d="M 0 -16 L 4 -4 L 16 0 L 4 4 L 0 16 L -4 4 L -16 0 L -4 -4 Z"
        fill="#6FAB75"
        stroke="white"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <circle cx="0" cy="0" r="2" fill="white" />
    </g>
  );
}

function Cloud() {
  return (
    <g>
      <path
        d="M 8 26 Q 4 26 4 21 Q 4 16 10 16 Q 11 10 18 10 Q 26 10 27 17 Q 36 17 36 23 Q 36 28 30 28 L 10 28 Q 8 28 8 26 Z"
        fill="white"
        stroke="white"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M 8 26 Q 4 26 4 21 Q 4 16 10 16 Q 11 10 18 10 Q 26 10 27 17 Q 36 17 36 23 Q 36 28 30 28 L 10 28 Q 8 28 8 26 Z"
        fill="#FBFEFC"
      />
    </g>
  );
}

function Chart() {
  return (
    <g>
      <rect
        x="4"
        y="6"
        width="32"
        height="28"
        rx="3"
        fill="#FBFEFC"
        stroke="white"
        strokeWidth={3}
      />
      {/* four shades of green (was pink + yellow + green) */}
      <rect x="9" y="22" width="4" height="8" fill="#9FCFA7" />
      <rect x="16" y="16" width="4" height="14" fill="#6FAB75" />
      <rect x="23" y="10" width="4" height="20" fill="#2F5C3C" />
      <rect x="30" y="20" width="4" height="10" fill="#5FA374" />
    </g>
  );
}

function Coin() {
  return (
    <g>
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="#9FCFA7"
        stroke="white"
        strokeWidth={3}
      />
      <circle cx="20" cy="20" r="10" fill="#6FAB75" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="14"
        fontWeight={800}
        fill="white"
        fontFamily="system-ui, sans-serif"
      >
        $
      </text>
    </g>
  );
}

function Letter() {
  return (
    <g transform="translate(2 8)">
      <rect
        x="0"
        y="0"
        width="36"
        height="24"
        rx="2"
        fill="white"
        stroke="white"
        strokeWidth={3}
      />
      <rect x="0" y="0" width="36" height="24" rx="2" fill="#FBFEFC" />
      {/* envelope flap — mint */}
      <path d="M 0 0 L 18 14 L 36 0" stroke="#6FAB75" strokeWidth={2.5} fill="none" />
      {/* wax seal — deep green */}
      <circle cx="29" cy="18" r="3" fill="#2F5C3C" stroke="white" strokeWidth={1.5} />
    </g>
  );
}
