import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getOnboardingState } from "../../lib/supabase/server";

/**
 * Chat-app layout — minimal header bar over the three-region grid.
 *
 * Auth gate: requires Supabase session AND completed onboarding. Routes
 * unauthenticated visitors to /onboarding; routes mid-flow to last step.
 *
 * Demo escape: `kali_demo_mode=rivertown` cookie OR `NEXT_PUBLIC_SUPABASE_URL`
 * unset both bypass the gate and mount Rivertown.
 */

export default async function ChatLayout({ children }: { children: ReactNode }) {
  const supaConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let tenantName = "Rivertown Community Foundation";
  let isDemo = !supaConfigured;

  if (supaConfigured) {
    const cookieJar = await cookies();
    const demoCookie = cookieJar.get("kali_demo_mode")?.value === "rivertown";
    if (demoCookie) {
      isDemo = true;
    } else {
      const { userId, state } = await getOnboardingState();
      if (!userId) redirect("/onboarding");
      if (!state?.onboardedAt) {
        const step = state?.currentStep ?? 1;
        redirect(`/onboarding?step=${step}`);
      }
      tenantName = state.tenant?.name ?? tenantName;
    }
  }

  return (
    <div className="chat-surface min-h-screen">
      <ChatHeader tenantName={tenantName} isDemo={isDemo} />
      <div className="pt-[64px]">{children}</div>
    </div>
  );
}

function ChatHeader({ tenantName, isDemo }: { tenantName: string; isDemo: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--mint-line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <KaliMark className="h-5 w-5 text-[var(--matcha-deep)]" />
          <span className="r-display text-xl font-medium tracking-tight text-[var(--matcha-deep)]">kali</span>
        </Link>
        <nav className="hidden items-center gap-3 sm:flex">
          <Link href="/dashboard" className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]">
            dashboard
          </Link>
          <Link href="/chat" className="rounded bg-[var(--mint-pale)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--matcha-deep)]">
            chat
          </Link>
        </nav>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          {tenantName.toLowerCase()}{isDemo ? " · demo tenant" : ""}
        </span>
      </div>

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--matcha-mid)]/15 text-xs font-medium text-[var(--matcha-deep)]">
        {tenantName.charAt(0).toUpperCase()}
      </div>
    </header>
  );
}

function KaliMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <circle cx="2.5" cy="10" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="17.5" cy="10" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="2.5" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="17.5" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
