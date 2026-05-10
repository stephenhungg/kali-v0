"use client";

import { ONBOARDING_STEPS } from "../../lib/supabase/types";

interface StepIndicatorProps {
  current: number;
}

/**
 * 6-bar progress indicator at the top of the wizard. Filled bars are
 * matcha-mid, current step is matcha-mid with a brighter outline,
 * upcoming bars are mint-line.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="flex items-center gap-1.5">
        {ONBOARDING_STEPS.map(s => {
          const state = s.n < current ? "done" : s.n === current ? "active" : "future";
          return (
            <div key={s.n} className="flex flex-1 flex-col gap-1">
              <span
                className={`h-1 rounded-full transition-colors ${
                  state === "done" ? "bg-[var(--matcha-mid)]"
                  : state === "active" ? "bg-[var(--matcha-deep)]"
                  : "bg-[var(--mint-line)]"
                }`}
              />
              <span
                className={`hidden font-mono text-[9px] uppercase tracking-[0.14em] sm:block ${
                  state === "future" ? "text-[var(--gray-ink)]" : "text-[var(--matcha-deep)]"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)] sm:hidden">
        <span>step {current} of {ONBOARDING_STEPS.length}</span>
        <span>{ONBOARDING_STEPS.find(s => s.n === current)?.label}</span>
      </div>
    </div>
  );
}
