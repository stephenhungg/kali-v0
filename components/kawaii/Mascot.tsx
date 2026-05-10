/**
 * Mochi — the Kali mascot. Round strawberry-matcha mochi creature, drawn
 * inline as SVG so it scales freely + ships zero bytes outside the bundle.
 *
 * The geometry stays identical across poses (round body, dot eyes, cheek
 * blushes, leaf crown). Only the prop in the mascot's hands and the mouth
 * shape change. This is by design: per the kawaii brand lock, the mascot
 * must read as the same character on every page.
 */

import type { CSSProperties } from "react";

export type MascotPose =
  | "wave"
  | "read"
  | "chart"
  | "coin"
  | "letter"
  | "sleep"
  | "cheer";

export interface MascotProps {
  pose?: MascotPose;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Whether to drop-shadow the mascot like a sticker. Default: true. */
  sticker?: boolean;
  /** Set to false to disable the gentle bob animation. Default: true. */
  animated?: boolean;
  /** Tilts the mascot for hand-placed feel. Default: -3 deg. */
  tiltDeg?: number;
}

const VIEWBOX = "0 0 120 120";

export function Mascot({
  pose = "wave",
  size = 96,
  className,
  style,
  sticker = true,
  animated = true,
  tiltDeg = -3,
}: MascotProps) {
  const filterStyle: CSSProperties = sticker
    ? { filter: "drop-shadow(2px 3px 0 var(--sticker-shadow))" }
    : {};

  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        transform: `rotate(${tiltDeg}deg)`,
        animation: animated ? "mochi-bob 3.4s ease-in-out infinite" : undefined,
        ...filterStyle,
        ...style,
      }}
    >
      <svg viewBox={VIEWBOX} width="100%" height="100%" aria-hidden>
        <Body />
        <LeafCrown />
        <Cheeks />
        <Eyes pose={pose} />
        <Mouth pose={pose} />
        <Prop pose={pose} />
      </svg>
    </div>
  );
}

/* ─── parts ──────────────────────────────────────────────────────────── */

function Body() {
  return (
    <g>
      {/* white keyline body — sticker outline */}
      <ellipse cx="60" cy="68" rx="44" ry="40" fill="white" />
      <ellipse cx="60" cy="68" rx="40" ry="36" fill="#FBFEFC" />
      {/* pale mint belly tint */}
      <ellipse cx="60" cy="78" rx="26" ry="20" fill="#DCEDDF" opacity="0.7" />
    </g>
  );
}

function LeafCrown() {
  // Two soft matcha leaves on top — subtle, not a giant hat.
  return (
    <g transform="translate(60 28)">
      <path
        d="M -8 0 Q -14 -10 -2 -10 Q 0 -2 -8 0 Z"
        fill="#6FAB75"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M 8 0 Q 14 -10 2 -10 Q 0 -2 8 0 Z"
        fill="#6FAB75"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="0" cy="-2" r="2" fill="#2F5C3C" />
    </g>
  );
}

function Cheeks() {
  // Soft mint cheeks (was strawberry pink).
  return (
    <g>
      <ellipse cx="40" cy="72" rx="6" ry="4" fill="#9FCFA7" opacity="0.6" />
      <ellipse cx="80" cy="72" rx="6" ry="4" fill="#9FCFA7" opacity="0.6" />
    </g>
  );
}

function Eyes({ pose }: { pose: MascotPose }) {
  if (pose === "sleep") {
    return (
      <g>
        <path
          d="M 40 64 Q 46 60 52 64"
          stroke="#1F2D26"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 68 64 Q 74 60 80 64"
          stroke="#1F2D26"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  if (pose === "cheer") {
    // ^ ^ excited eyes
    return (
      <g>
        <path
          d="M 40 66 L 46 60 L 52 66"
          stroke="#1F2D26"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M 68 66 L 74 60 L 80 66"
          stroke="#1F2D26"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="46" cy="62" rx="3" ry="3.6" fill="#1F2D26" />
      <ellipse cx="74" cy="62" rx="3" ry="3.6" fill="#1F2D26" />
      {/* glint */}
      <ellipse cx="47" cy="60.5" rx="0.9" ry="1.1" fill="white" />
      <ellipse cx="75" cy="60.5" rx="0.9" ry="1.1" fill="white" />
    </g>
  );
}

function Mouth({ pose }: { pose: MascotPose }) {
  // Different smile shapes per mood, but always in the same spot.
  if (pose === "cheer" || pose === "wave") {
    return (
      <path
        d="M 54 78 Q 60 86 66 78"
        stroke="#1F2D26"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="#9FCFA7"
        fillOpacity="0.55"
      />
    );
  }
  if (pose === "sleep") {
    return (
      <ellipse cx="60" cy="80" rx="3" ry="2" fill="#1F2D26" opacity="0.7" />
    );
  }
  return (
    <path
      d="M 56 78 Q 60 82 64 78"
      stroke="#1F2D26"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Prop({ pose }: { pose: MascotPose }) {
  if (pose === "wave") {
    // little waving paw
    return (
      <g transform="translate(98 66) rotate(-15)">
        <ellipse cx="0" cy="0" rx="7" ry="6" fill="white" />
        <ellipse cx="0" cy="0" rx="5.5" ry="4.5" fill="#FBFEFC" />
        <circle cx="-2" cy="-1" r="1" fill="#6FAB75" opacity="0.55" />
      </g>
    );
  }
  if (pose === "read") {
    // small folder/book in front of the body
    return (
      <g transform="translate(60 92)">
        <rect
          x="-14"
          y="-6"
          width="28"
          height="14"
          rx="3"
          fill="#6FAB75"
          stroke="white"
          strokeWidth="2"
        />
        <rect x="-10" y="-2" width="20" height="2" rx="1" fill="white" opacity="0.7" />
        <rect x="-10" y="2" width="14" height="2" rx="1" fill="white" opacity="0.7" />
      </g>
    );
  }
  if (pose === "chart") {
    // tiny bar chart held up — three shades of green
    return (
      <g transform="translate(96 78) rotate(-8)">
        <rect x="-1" y="-2" width="3" height="10" fill="#9FCFA7" stroke="white" strokeWidth="1" />
        <rect x="3" y="-6" width="3" height="14" fill="#6FAB75" stroke="white" strokeWidth="1" />
        <rect x="7" y="-10" width="3" height="18" fill="#2F5C3C" stroke="white" strokeWidth="1" />
      </g>
    );
  }
  if (pose === "coin") {
    return (
      <g transform="translate(94 80) rotate(8)">
        <circle cx="0" cy="0" r="9" fill="#DCEDDF" stroke="white" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="5" fill="#6FAB75" />
        <text
          x="0"
          y="2.5"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill="white"
          fontFamily="system-ui, sans-serif"
        >
          $
        </text>
      </g>
    );
  }
  if (pose === "letter") {
    return (
      <g transform="translate(96 80) rotate(-6)">
        <rect
          x="-9"
          y="-6"
          width="18"
          height="12"
          rx="1.5"
          fill="white"
          stroke="#6FAB75"
          strokeWidth="2"
        />
        <path d="M -9 -6 L 0 0 L 9 -6" stroke="#6FAB75" strokeWidth="2" fill="none" />
      </g>
    );
  }
  if (pose === "sleep") {
    return (
      <g transform="translate(92 50)">
        <text
          x="0"
          y="0"
          fontSize="14"
          fontWeight="700"
          fill="#6FAB75"
          fontFamily="system-ui, sans-serif"
        >
          z
        </text>
        <text
          x="6"
          y="-8"
          fontSize="10"
          fontWeight="700"
          fill="#6FAB75"
          fontFamily="system-ui, sans-serif"
          opacity="0.7"
        >
          z
        </text>
      </g>
    );
  }
  if (pose === "cheer") {
    return (
      <g>
        {/* sparkles around the body */}
        <Sparkle x={20} y={40} size={6} />
        <Sparkle x={100} y={45} size={8} />
        <Sparkle x={108} y={92} size={5} />
        <Sparkle x={14} y={92} size={6} />
      </g>
    );
  }
  return null;
}

function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  const half = size / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 -${half} L ${half / 3} -${half / 3} L ${half} 0 L ${half / 3} ${half / 3} L 0 ${half} L -${half / 3} ${half / 3} L -${half} 0 L -${half / 3} -${half / 3} Z`}
        fill="#6FAB75"
        stroke="white"
        strokeWidth="1.5"
      />
    </g>
  );
}
