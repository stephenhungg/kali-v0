import { Suspense } from "react";
import { OnboardingShell } from "../../components/onboarding/OnboardingShell";

export default function OnboardingPage() {
  // OnboardingShell uses useSearchParams — prerender requires a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-56px)] items-center justify-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            loading…
          </div>
        </div>
      }
    >
      <OnboardingShell />
    </Suspense>
  );
}
