"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { StepProps } from "./OnboardingShell";

interface Step1Props extends StepProps {
  onSignedUp: () => Promise<void>;
}

type Mode = "signup" | "signin" | "confirm-email";

export function Step1Signup({ onSignedUp }: Step1Props) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Listen for sign-in events. If email confirmation is enabled, the user
  // clicks the link in their email → Supabase fires SIGNED_IN here → we
  // advance automatically without needing them to click anything.
  useEffect(() => {
    let alive = true;
    const supa = getSupabaseBrowserClient();
    const { data: sub } = supa.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        await onSignedUp();
      }
    });
    // Also check on mount — they may already be signed in (refresh / multi-tab).
    supa.auth.getSession().then(({ data }) => {
      if (alive && data.session) onSignedUp();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [onSignedUp]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup" && password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const supa = getSupabaseBrowserClient();

      if (mode === "signin") {
        const { data, error: signErr } = await supa.auth.signInWithPassword({ email, password });
        if (signErr) {
          setError(humanError(signErr.message));
          return;
        }
        if (data.session) await onSignedUp();
        else setError("signed in but no session — try again");
        return;
      }

      // mode === "signup"
      const { data, error: signErr } = await supa.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signErr) {
        // Common case: user already exists. Offer to sign in instead.
        const msg = humanError(signErr.message);
        if (/already registered|already exists/i.test(signErr.message)) {
          setMode("signin");
          setInfo("That email already has an account. Sign in instead.");
        } else {
          setError(msg);
        }
        return;
      }

      if (data.session) {
        // Email confirmation disabled (or already confirmed) → straight in.
        await onSignedUp();
        return;
      }
      if (data.user) {
        // Email confirmation REQUIRED. Show the verify-email UI.
        setMode("confirm-email");
        setInfo(`Check ${email} for a verification link. We'll continue automatically once you click it.`);
        return;
      }
      setError("signup failed — try again");
    } catch (e: any) {
      setError(e?.message ?? "signup failed");
    } finally {
      setBusy(false);
    }
  };

  // After-the-fact session check (for the verify-email screen). Most users
  // don't need this — onAuthStateChange handles it — but some browsers /
  // tab switches can miss the event.
  const recheckSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const supa = getSupabaseBrowserClient();
      const { data } = await supa.auth.getSession();
      if (data.session) {
        await onSignedUp();
      } else {
        setError("Still no session. Click the verification link in your email, then try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── confirm-email state ───────────────────────────────────────── */
  if (mode === "confirm-email") {
    return (
      <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
              one more step
            </span>
            <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[44px]">
              Check your inbox{" "}
              <span className="r-italic font-light text-[var(--matcha-mid)]">→</span>
            </h1>
            <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
              {info ?? `We sent a verification link to ${email}. Click it to activate your account.`}
            </p>
          </div>

          <div className="rounded border border-[var(--mint-line)] bg-[var(--mint-pale)]/40 p-4 text-[13px] leading-relaxed text-[var(--matcha-deep)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
              tip · for the demo
            </span>
            <p className="mt-1">
              Disable email confirmation in <span className="font-mono text-[12px]">Supabase → Authentication → Providers → Email → "Confirm email" off</span> to skip this step entirely.
            </p>
          </div>

          {error && (
            <div className="rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 px-3 py-2 text-[13px] text-[var(--strawberry-deep)]">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={recheckSession}
              disabled={busy}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "checking…" : "i confirmed it"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setInfo(null); setError(null); }}
              className="font-mono text-[11px] text-[var(--gray-ink)] underline-offset-2 hover:text-[var(--matcha-deep)] hover:underline"
            >
              ← use a different email
            </button>
          </div>
        </div>

        <SidebarNote
          title="Why we need verification"
          body="Supabase requires it by default. We disabled it in our demo project, but if your project still has it on, this step will catch it."
        />
      </div>
    );
  }

  /* ── signup / signin form ──────────────────────────────────────── */
  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            {mode === "signup" ? "create your account" : "welcome back"}
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[48px]">
            {mode === "signup" ? "Set up Kali for your nonprofit" : "Sign back in"}{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">in 4 minutes.</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            {mode === "signup"
              ? "We'll connect to your existing tools, index your historical data, and have your team asking questions in plain English by the end of this flow."
              : "Pick up where you left off. Your tenant + connector selections + uploads are saved."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <Field label="Your name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Chen"
                required
                autoComplete="name"
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Work email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@yourfoundation.org"
              required
              autoComplete="email"
              className={inputClass}
            />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "8+ characters" : undefined}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputClass}
            />
          </Field>

          {error && (
            <div className="rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 px-3 py-2 text-[13px] text-[var(--strawberry-deep)]">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="rounded border border-[var(--mint-line)] bg-[var(--mint-pale)]/50 px-3 py-2 text-[13px] text-[var(--matcha-deep)]">
              {info}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !email || !password || (mode === "signup" && !name)}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? mode === "signup" ? "creating…" : "signing in…"
                : mode === "signup" ? "continue →" : "sign in →"}
            </button>
            <button
              type="button"
              onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setInfo(null); }}
              className="font-mono text-[11px] text-[var(--gray-ink)] underline-offset-2 hover:text-[var(--matcha-deep)] hover:underline"
            >
              {mode === "signup" ? "already have an account? sign in" : "new here? create account"}
            </button>
          </div>
        </form>
      </div>

      <SidebarNote
        title="Why we ask"
        body="Kali is a SaaS — every nonprofit gets its own isolated instance with their data, their connectors, their team. We use email + password for sign-in (SSO is on the roadmap)."
      />
    </div>
  );
}

const inputClass =
  "w-full rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 font-sans text-[15px] text-[var(--matcha-deep)] outline-none transition-colors placeholder:text-[var(--gray-ink)] focus:border-[var(--matcha-mid)] focus:bg-[var(--mint-pale)]/30";

function humanError(msg: string): string {
  if (/already registered|already exists/i.test(msg)) return "An account with that email already exists.";
  if (/invalid login credentials/i.test(msg)) return "Email or password didn't match.";
  if (/email not confirmed/i.test(msg)) return "Email not confirmed yet — click the link we sent you.";
  if (/password should be at least/i.test(msg)) return "Password must be at least 8 characters.";
  if (/rate limit/i.test(msg)) return "Too many attempts — try again in a minute.";
  return msg;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">
        {label}{hint && <span className="ml-1.5 normal-case tracking-normal text-[var(--matcha-mid)]">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function SidebarNote({ title, body }: { title: string; body: string }) {
  return (
    <aside className="hidden self-start rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] p-4 sm:block">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--matcha-mid)]">
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--matcha-deep)]/80">{body}</p>
    </aside>
  );
}
