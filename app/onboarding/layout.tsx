import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Onboarding layout — minimal header w/ kali wordmark + "back to landing"
 * escape. Wraps every step page. The step indicator is rendered inside
 * page.tsx because it needs the live current-step state.
 */

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="chat-surface min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--mint-line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <KaliMark className="h-5 w-5 text-[var(--matcha-deep)]" />
          <span className="r-display text-xl font-medium tracking-tight text-[var(--matcha-deep)]">kali</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          getting started
        </span>
        <Link
          href="/"
          className="font-mono text-[11px] text-[var(--gray-ink)] underline-offset-2 hover:text-[var(--matcha-deep)] hover:underline"
        >
          ← exit
        </Link>
      </header>
      <main className="pt-14">{children}</main>
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
