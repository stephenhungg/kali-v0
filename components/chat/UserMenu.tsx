"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

interface UserMenuProps {
  email: string | null;
  tenantName: string;
  tenantMission?: string | null;
  isDemo: boolean;
  /** Optional: called right before redirect after sign-out so the host can reset its state. */
  onSignOut?: () => void;
}

/**
 * Avatar button + popover. Click the circle to expand a menu showing the
 * logged-in user, the tenant they belong to, quick nav links, and a sign-out
 * action. Closes on outside click, Escape, or after a navigation.
 *
 * Demo mode (`isDemo` true) hides the email field + sign-out — the demo
 * tenant has no real session to drop, just a cookie. The cookie clear is
 * handled by the "exit demo" link.
 */
export function UserMenu({ email, tenantName, tenantMission, isDemo, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (email?.charAt(0) ?? tenantName.charAt(0) ?? "K").toUpperCase();

  const handleSignOut = async () => {
    setBusy(true);
    try {
      if (!isDemo) {
        // Clear Supabase session cookies via the browser client.
        try {
          const supa = getSupabaseBrowserClient();
          await supa.auth.signOut();
        } catch {
          // If browser client throws (e.g. no Supabase env at runtime),
          // fall back to clearing demo cookie + redirect.
        }
      }
      // Always clear the demo cookie too — covers the case where the user
      // entered via ?demo=rivertown then signed in later.
      document.cookie = "kali_demo_mode=; Max-Age=0; path=/; sameSite=lax";
      onSignOut?.();
      // Hard navigation so middleware re-evaluates the session and any
      // server-component caches drop.
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  };

  const handleExitDemo = () => {
    document.cookie = "kali_demo_mode=; Max-Age=0; path=/; sameSite=lax";
    onSignOut?.();
    window.location.href = "/";
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--matcha-mid)]/15 text-xs font-medium text-[var(--matcha-deep)] transition-colors hover:bg-[var(--matcha-mid)]/25"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-md border border-[var(--mint-line)] bg-[var(--surface)] shadow-lg"
          style={{ animation: "row-rise 220ms var(--r-ease)" }}
        >
          {/* Identity block */}
          <div className="border-b border-[var(--mint-line-soft)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full font-display text-[16px] font-medium"
                style={{
                  background: "var(--matcha-mid)",
                  color: "var(--cream)",
                }}
              >
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--matcha-deep)]">
                  {isDemo ? "Demo viewer" : email ?? "Signed in"}
                </div>
                <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
                  {tenantName.toLowerCase()}{isDemo ? " · demo" : ""}
                </div>
              </div>
            </div>
            {tenantMission && (
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[var(--gray-ink)]">
                {tenantMission}
              </p>
            )}
          </div>

          {/* Quick links */}
          <ul className="py-1.5">
            <MenuLink href="/dashboard" label="Dashboard" hint="Overview + receipts" onClick={() => setOpen(false)} />
            <MenuLink href="/chat" label="Chat" hint="Ask Kali anything" onClick={() => setOpen(false)} />
            <MenuLink href="/crypto" label="Crypto" hint="x402 + cause coins" onClick={() => setOpen(false)} />
            {!isDemo && (
              <MenuLink href="/onboarding?step=2" label="Edit profile" hint="Tenant + connectors" onClick={() => setOpen(false)} />
            )}
          </ul>

          {/* Sign-out / exit demo */}
          <div className="border-t border-[var(--mint-line-soft)] py-1.5">
            {isDemo ? (
              <button
                type="button"
                onClick={handleExitDemo}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-[13px] text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]"
              >
                <span>Exit demo</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
                  → home
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-[13px] text-[var(--strawberry-deep)] transition-colors hover:bg-[var(--strawberry-soft)]/30 disabled:opacity-50"
              >
                <span>{busy ? "Signing out…" : "Sign out"}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--strawberry-deep)]/60">
                  ↩
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  label,
  hint,
  onClick,
}: {
  href: string;
  label: string;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        role="menuitem"
        className="flex items-center justify-between px-4 py-2 text-[13px] text-[var(--matcha-deep)] transition-colors hover:bg-[var(--mint-pale)]"
      >
        <span>{label}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
          {hint}
        </span>
      </Link>
    </li>
  );
}
