import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getOnboardingState } from "../../lib/supabase/server";
import { UserMenu } from "../../components/chat/UserMenu";

/**
 * Chat-app layout — locked-viewport flex column.
 *
 * Header at top (h-16, in normal flow), the rest of the viewport `flex-1`
 * for the chat shell. No more `pt-16` + fixed-header dance — that gave the
 * top utility bar nowhere to live and pushed the composer off-screen on
 * smaller viewports. Internal regions use `min-h-0` so they actually
 * shrink instead of overflowing.
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
  let tenantMission: string | undefined;
  let userEmail: string | null = null;
  let isDemo = !supaConfigured;

  if (supaConfigured) {
    const cookieJar = await cookies();
    const demoCookie = cookieJar.get("kali_demo_mode")?.value === "rivertown";
    if (demoCookie) {
      isDemo = true;
    } else {
      const { userId, email, state } = await getOnboardingState();
      if (!userId) redirect("/onboarding");
      if (!state?.onboardedAt) {
        const step = state?.currentStep ?? 1;
        redirect(`/onboarding?step=${step}`);
      }
      tenantName = state.tenant?.name ?? tenantName;
      tenantMission = state.tenant?.mission;
      userEmail = email;
    }
  }

  return (
    <div className="chat-surface flex h-[100dvh] flex-col overflow-hidden">
      <ChatHeader
        tenantName={tenantName}
        tenantMission={tenantMission}
        userEmail={userEmail}
        isDemo={isDemo}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function ChatHeader({
  tenantName,
  tenantMission,
  userEmail,
  isDemo,
}: {
  tenantName: string;
  tenantMission?: string;
  userEmail: string | null;
  isDemo: boolean;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--mint-line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
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
          <Link href="/crypto" className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]">
            crypto
          </Link>
        </nav>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          {tenantName.toLowerCase()}{isDemo ? " · demo tenant" : ""}
        </span>
      </div>

      <UserMenu
        email={userEmail}
        tenantName={tenantName}
        tenantMission={tenantMission}
        isDemo={isDemo}
      />
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
