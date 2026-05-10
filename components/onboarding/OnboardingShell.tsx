"use client";

/**
 * OnboardingShell — the wizard orchestrator.
 *
 * - Loads OnboardingState from /api/onboarding/step on mount (resume support).
 * - Owns the "current step" state, syncs to URL ?step=N for browser back/fwd.
 * - Persists state via POST /api/onboarding/step on every transition.
 * - Renders StepIndicator + the active step component.
 *
 * Each step component receives the same handlers + a slice of state and
 * decides when to call `next()` / `back()` / `setState()`.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, type OnboardingState } from "../../lib/supabase/types";
import { StepIndicator } from "./StepIndicator";
import { Step1Signup } from "./Step1_Signup";
import { Step2Profile } from "./Step2_Profile";
import { Step3StackPicker } from "./Step3_StackPicker";
import { Step4Connect } from "./Step4_Connect";
import { Step5DataDrop } from "./Step5_DataDrop";
import { Step6Welcome } from "./Step6_Welcome";

const MAX_STEP = ONBOARDING_STEPS.length; // 6

export interface StepProps {
  state: OnboardingState;
  /** Patch local + persist server-side. Returns merged. */
  setState: (patch: Partial<OnboardingState>) => Promise<OnboardingState>;
  next: () => Promise<void>;
  back: () => void;
  /** Skip current step without persisting (e.g., "skip remaining connectors"). */
  skip: () => Promise<void>;
}

export function OnboardingShell() {
  const router = useRouter();
  const sp = useSearchParams();
  const stepFromUrl = Math.max(1, Math.min(MAX_STEP, parseInt(sp.get("step") ?? "1", 10) || 1));

  const [state, setLocalState] = useState<OnboardingState>({ currentStep: stepFromUrl });
  const [hydrated, setHydrated] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // On mount: try to resume from server. If 401, we're not signed up yet —
  // stay on step 1 with empty state.
  useEffect(() => {
    let alive = true;
    fetch("/api/onboarding/step")
      .then(async r => {
        if (!alive) return;
        if (r.status === 401) {
          setHasSession(false);
          setHydrated(true);
          return;
        }
        const data = await r.json();
        if (!alive) return;
        setHasSession(true);
        if (data.state) {
          // Resume from persisted state — but URL ?step= overrides if user navigated.
          const resumeStep = Math.max(stepFromUrl, data.state.currentStep ?? 1);
          setLocalState({ ...data.state, currentStep: Math.min(MAX_STEP, resumeStep) });
        }
        setHydrated(true);
      })
      .catch(() => { if (alive) setHydrated(true); });
    return () => { alive = false; };
    // We only want to hydrate once on mount. URL changes are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL ?step=N when state.currentStep changes.
  useEffect(() => {
    const cur = parseInt(sp.get("step") ?? "1", 10);
    if (cur !== state.currentStep) {
      router.replace(`/onboarding?step=${state.currentStep}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentStep]);

  const persist = useCallback(async (patch: Partial<OnboardingState>): Promise<OnboardingState> => {
    // Optimistic local update.
    setLocalState(prev => ({ ...prev, ...patch }));
    // Server merge — only after we have a session (post-step 1).
    if (hasSession) {
      try {
        const res = await fetch("/api/onboarding/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.state) {
            setLocalState(data.state);
            return data.state;
          }
        }
      } catch {
        // network error — local state still applied, will retry on next persist
      }
    }
    return { ...state, ...patch };
  }, [hasSession, state]);

  const next = useCallback(async () => {
    const nextStep = Math.min(MAX_STEP, state.currentStep + 1);
    await persist({ currentStep: nextStep });
  }, [persist, state.currentStep]);

  const back = useCallback(() => {
    setLocalState(prev => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) }));
  }, []);

  const skip = useCallback(async () => {
    await next();
  }, [next]);

  // After step 1 succeeds (signup), the page calls onSignedUp() to flip hasSession + advance.
  const onSignedUp = useCallback(async () => {
    setHasSession(true);
    // Hit /api/onboarding/step to seed user_metadata for the new user.
    try {
      const res = await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: 2 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setLocalState(data.state);
          return;
        }
      }
    } catch { /* */ }
    setLocalState(prev => ({ ...prev, currentStep: 2 }));
  }, []);

  const props: StepProps = { state, setState: persist, next, back, skip };

  if (!hydrated) {
    return (
      <div className="flex min-h-[calc(100dvh-56px)] items-center justify-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">loading…</div>
      </div>
    );
  }

  return (
    <div
      className="kawaii-page"
      style={{ display: "flex", minHeight: "calc(100dvh - 56px)", flexDirection: "column" }}
    >
      <div
        style={{
          borderBottom: "2px dashed var(--hair)",
          background: "rgba(255, 247, 240, 0.85)",
          backdropFilter: "blur(6px)",
          padding: "16px 0",
        }}
      >
        <StepIndicator current={state.currentStep} />
      </div>
      <div className="flex-1 overflow-y-auto py-8 sm:py-12">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          {state.currentStep === 1 && <Step1Signup {...props} onSignedUp={onSignedUp} />}
          {state.currentStep === 2 && <Step2Profile {...props} />}
          {state.currentStep === 3 && <Step3StackPicker {...props} />}
          {state.currentStep === 4 && <Step4Connect {...props} />}
          {state.currentStep === 5 && <Step5DataDrop {...props} />}
          {state.currentStep === 6 && <Step6Welcome {...props} />}
        </div>
      </div>
    </div>
  );
}
