import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Chat-app layout — minimal header bar over the three-region grid.
 * White surface, mint accents. Matches landing brand without copy-pasting it.
 */

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="chat-surface min-h-screen">
      <ChatHeader />
      <div className="pt-[64px]">{children}</div>
    </div>
  );
}

function ChatHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--mint-line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <KaliMark className="h-5 w-5 text-[var(--matcha-deep)]" />
        <span className="r-display text-xl font-medium tracking-tight text-[var(--matcha-deep)]">kali</span>
      </Link>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)] blink-soft" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
          rivertown community foundation · demo tenant
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="hidden rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--matcha-deep)] transition-colors hover:bg-[var(--mint-pale)] sm:inline-block"
        >
          ← landing
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--matcha-mid)]/15 text-xs font-medium text-[var(--matcha-deep)]">
          R
        </div>
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
