/**
 * Cute primitives — `CuteCard`, `CuteButton`, `CuteHeader`, `CuteStat`,
 * `CutePill`. Use these instead of raw <div> for any kawaii surface so
 * the sticker shadow + rounded corners + pastel surface treatment stays
 * consistent.
 *
 * Each primitive picks from the brand-locked palette tokens defined in
 * app/globals.css (--paper, --cloud, --mochi, --matcha-pale, --hair, etc).
 */

import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { StickerAccent, type StickerProp } from "./StickerAccent";

/* ─── CuteCard ───────────────────────────────────────────────────────── */

export type CuteCardTone = "paper" | "cloud" | "mochi" | "matcha" | "lemon";

export interface CuteCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CuteCardTone;
  /** Accent prop sticker pinned to the top-right corner. */
  accent?: StickerProp;
  /** When true, applies a slight rotation for hand-placed feel. */
  tilt?: boolean;
  children?: ReactNode;
}

// White + mint card surfaces. `lemon` is repurposed as a slightly warmer
// off-white (still mint-tinted) so connector tiles can vary subtly without
// breaking the white+mint palette.
const TONE_BG: Record<CuteCardTone, string> = {
  paper: "var(--paper)",
  cloud: "var(--cloud)",
  mochi: "var(--mochi)",
  matcha: "var(--matcha-pale)",
  lemon: "#F4FAF5",
};

export function CuteCard({
  tone = "paper",
  accent,
  tilt = false,
  className = "",
  children,
  style,
  ...rest
}: CuteCardProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: TONE_BG[tone],
        border: "3px solid white",
        borderRadius: 18,
        padding: "20px 22px",
        boxShadow: "3px 4px 0 var(--sticker-shadow)",
        transform: tilt ? "rotate(-0.6deg)" : undefined,
        ...style,
      }}
      {...rest}
    >
      {accent && (
        <span
          style={{
            position: "absolute",
            top: -14,
            right: -10,
            zIndex: 2,
          }}
        >
          <StickerAccent prop={accent} size={42} tiltDeg={12} />
        </span>
      )}
      {children}
    </div>
  );
}

/* ─── CuteButton ─────────────────────────────────────────────────────── */

export type CuteButtonTone = "sakura" | "matcha" | "ghost";

interface CuteButtonOwnProps {
  tone?: CuteButtonTone;
  /** Renders a Link if href is provided, otherwise a button. */
  href?: string;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

type CuteButtonProps = CuteButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CuteButtonOwnProps>;

const SIZE_STYLES: Record<NonNullable<CuteButtonOwnProps["size"]>, CSSProperties> = {
  sm: { padding: "8px 14px", fontSize: 12, borderRadius: 12 },
  md: { padding: "12px 22px", fontSize: 14, borderRadius: 14 },
  lg: { padding: "16px 28px", fontSize: 15, borderRadius: 16 },
};

const TONE_STYLES: Record<CuteButtonTone, CSSProperties> = {
  sakura: {
    background: "var(--sakura)",
    color: "white",
    border: "3px solid white",
    boxShadow: "2px 3px 0 var(--sticker-shadow)",
  },
  matcha: {
    background: "var(--matcha)",
    color: "white",
    border: "3px solid white",
    boxShadow: "2px 3px 0 var(--sticker-shadow-deep)",
  },
  ghost: {
    background: "white",
    color: "var(--ink)",
    border: "3px solid var(--hair)",
    boxShadow: "2px 3px 0 rgba(245, 221, 211, 0.6)",
  },
};

export function CuteButton({
  tone = "sakura",
  href,
  size = "md",
  className = "",
  children,
  style,
  ...rest
}: CuteButtonProps) {
  const merged: CSSProperties = {
    fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
    fontWeight: 700,
    letterSpacing: "0.01em",
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease",
    transform: "rotate(-0.8deg)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    ...SIZE_STYLES[size],
    ...TONE_STYLES[tone],
    ...style,
  };
  if (href) {
    return (
      <Link href={href} className={`cute-btn ${className}`} style={merged}>
        {children}
      </Link>
    );
  }
  return (
    <button className={`cute-btn ${className}`} style={merged} {...rest}>
      {children}
    </button>
  );
}

/* ─── CuteStat ───────────────────────────────────────────────────────── */

export interface CuteStatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: StickerProp;
  tone?: CuteCardTone;
  className?: string;
}

export function CuteStat({ label, value, sub, accent, tone = "paper", className }: CuteStatProps) {
  return (
    <CuteCard tone={tone} accent={accent} className={className}>
      <div
        style={{
          fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
          fontSize: 32,
          fontWeight: 800,
          marginTop: 6,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            color: "var(--mute)",
          }}
        >
          {sub}
        </div>
      )}
    </CuteCard>
  );
}

/* ─── CutePill ───────────────────────────────────────────────────────── */

export interface CutePillProps {
  tone?: "sakura" | "matcha" | "lemon" | "cloud" | "mochi" | "neutral";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// White + mint pill palette. Background → very pale mint; foreground →
// deep evergreen for contrast. Variants get distinguishable but stay in
// the same green family.
const PILL_COLORS: Record<NonNullable<CutePillProps["tone"]>, [string, string]> = {
  sakura:  ["#D7E8D9", "#2F5C3C"],  // primary — soft mint surface, dark text
  matcha:  ["#C5E0CA", "#234B30"],  // deeper mint (status: connected/live)
  lemon:   ["#ECF6EE", "#3A6A48"],  // very pale — neutral status
  cloud:   ["#F4FAF5", "#5F8567"],  // near-white — quietest tone
  mochi:   ["#DCEDDF", "#2F5C3C"],  // light mint
  neutral: ["#E6EFE9", "#3D4E40"],  // mint-grey
};

export function CutePill({
  tone = "sakura",
  children,
  className = "",
  style,
}: CutePillProps) {
  const [bg, fg] = PILL_COLORS[tone];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color: fg,
        border: "2px solid white",
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        boxShadow: "1px 2px 0 var(--sticker-shadow)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── CuteSection (page-level wrapper) ───────────────────────────────── */

export function CuteSection({
  children,
  className = "",
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={className}
      style={{
        position: "relative",
        ...style,
      }}
    >
      {children}
    </section>
  );
}
