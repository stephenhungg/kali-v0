import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getOnboardingState } from "../../lib/supabase/server";
import { UserMenu } from "../../components/chat/UserMenu";

/**
 * Dashboard layout — header bar shared with /chat. Avatar opens a profile
 * popover with email, tenant info, quick links, and sign-out.
 */

export default async function DashboardLayout({ children }: { children: ReactNode }) {
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
      const { email, state } = await getOnboardingState();
      tenantName = state?.tenant?.name ?? tenantName;
      tenantMission = state?.tenant?.mission;
      userEmail = email;
    }
  }

  return (
    <div className="chat-surface min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--mint-line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <KaliMark className="h-5 w-5 text-[var(--matcha-deep)]" />
            <span className="r-display text-xl font-medium tracking-tight text-[var(--matcha-deep)]">kali</span>
          </Link>
          <nav className="hidden items-center gap-3 sm:flex">
            <Link href="/dashboard" className="rounded bg-[var(--mint-pale)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--matcha-deep)]">
              dashboard
            </Link>
            <Link href="/chat" className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]">
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
      <div className="pt-16">{children}</div>
    </div>
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
