"use client";

import { ONBOARDING_STEPS } from "../../lib/supabase/types";

interface StepIndicatorProps {
  current: number;
}

/**
 * Sticker progress indicator. Each step is a chunky candy dot. Done →
 * sakura w/ checkmark, current → larger pulsing dot, future → cream.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {ONBOARDING_STEPS.map((s, i) => {
          const state = s.n < current ? "done" : s.n === current ? "active" : "future";
          return (
            <div
              key={s.n}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Dot state={state} />
              {i < ONBOARDING_STEPS.length - 1 && (
                <span
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 999,
                    background:
                      state === "done"
                        ? "var(--sakura)"
                        : "var(--hair)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--mute)",
        }}
      >
        <span>step {current} of {ONBOARDING_STEPS.length}</span>
        <span style={{ color: "var(--ink)" }}>
          {ONBOARDING_STEPS.find((s) => s.n === current)?.label}
        </span>
      </div>
    </div>
  );
}

function Dot({ state }: { state: "done" | "active" | "future" }) {
  if (state === "done") {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--sakura)",
          border: "2px solid white",
          boxShadow: "1px 2px 0 var(--sticker-shadow)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--matcha)",
          border: "3px solid white",
          boxShadow: "1px 2px 0 var(--sticker-shadow-deep)",
          flexShrink: 0,
        }}
        className="blink-soft"
      />
    );
  }
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "var(--paper)",
        border: "2px solid var(--hair)",
        flexShrink: 0,
      }}
    />
  );
}
