"use client";

import { useEffect, useRef } from "react";
import { Mascot } from "../kawaii/Mascot";
import { CuteCard } from "../kawaii/CutePrimitives";
import { StickerAccent, type StickerProp } from "../kawaii/StickerAccent";

const PLAYBOOKS: Array<{
  label: string;
  sub: string;
  detail: string;
  accent: StickerProp;
}> = [
  {
    label: "Who should I call this week?",
    sub: "donor outreach prioritization",
    detail: "Lapsed donors, recent engagement signals, matching-gift eligible.",
    accent: "letter",
  },
  {
    label: "What grants close in the next 30 days?",
    sub: "grant pipeline triage",
    detail: "Deadlines + fit scores + funder ties from the board.",
    accent: "chart",
  },
  {
    label: "Show me lapsed donors with matching gifts",
    sub: "the wow query — 3 connectors",
    detail: "Bloomerang × Salesforce × M365 — last contact + employer match.",
    accent: "strawberry",
  },
  {
    label: "Where's my cash, am I gonna make payroll?",
    sub: "finance × programs cross-check",
    detail: "Cash position + 90-day runway + at-risk program flags.",
    accent: "matcha-bowl",
  },
];

interface EmptyStateProps {
  onPick: (prompt: string) => void;
}

export function EmptyState({ onPick }: EmptyStateProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { gsap } = await import("gsap");
      if (!mounted || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current.querySelectorAll(".pb-row"),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08, delay: 0.1 },
      );
      gsap.fromTo(
        rootRef.current.querySelectorAll(".pb-head"),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.05 },
      );
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-10 sm:px-6 sm:py-14"
    >
      <div
        className="pb-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          marginBottom: 4,
        }}
      >
        <Mascot pose="wave" size={108} tiltDeg={-4} />
        <div style={{ flex: 1 }}>
          <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
            ask kali · cited answers across your nonprofit stack
          </span>
          <h1
            className="kawaii-display"
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 1.0,
              color: "var(--ink)",
              marginTop: 8,
            }}
          >
            what do you want to know{" "}
            <span style={{ color: "var(--sakura)", fontStyle: "italic" }}>today?</span>
            <StickerAccent prop="sparkle" size={28} tiltDeg={20} style={{ marginLeft: 8 }} />
          </h1>
          <p
            style={{
              marginTop: 10,
              maxWidth: 520,
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--mute)",
            }}
          >
            pick a starting question or type your own. every answer is cited back to the source
            record — donors, grants, emails, transcripts, txns. no black boxes.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {PLAYBOOKS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => onPick(p.label)}
            className="pb-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              textAlign: "left",
              background: "white",
              border: "3px solid white",
              borderRadius: 16,
              padding: "12px 16px",
              cursor: "pointer",
              boxShadow: "2px 3px 0 var(--sticker-shadow)",
              transform: i % 2 === 0 ? "rotate(-0.4deg)" : "rotate(0.4deg)",
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "rotate(0deg) translateY(-1px)";
              e.currentTarget.style.boxShadow = "3px 5px 0 var(--sticker-shadow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = i % 2 === 0 ? "rotate(-0.4deg)" : "rotate(0.4deg)";
              e.currentTarget.style.boxShadow = "2px 3px 0 var(--sticker-shadow)";
            }}
          >
            <StickerAccent prop={p.accent} size={42} tiltDeg={i % 2 === 0 ? -8 : 8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--ink)",
                  fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
                }}
              >
                {p.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--mute)",
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {p.detail}
              </span>
            </div>
            <span
              className="kawaii-mono-tag"
              style={{ color: "var(--sakura)", flexShrink: 0 }}
            >
              {p.sub} →
            </span>
          </button>
        ))}
      </div>

      <CuteCard tone="cloud" style={{ padding: "12px 16px" }}>
        <span className="kawaii-mono-tag">how this works</span>
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
          Kali calls real tools across your connected systems and shows you the work — every tool
          firing, every record it cited. the right panel is the receipt. the left panel pulses as
          sources get hit.
        </p>
      </CuteCard>
    </div>
  );
}
