"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { StepProps } from "./OnboardingShell";

interface Step1Props extends StepProps {
  onSignedUp: () => Promise<void>;
}

export function Step1Signup({ onSignedUp }: Step1Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const supa = getSupabaseBrowserClient();
      const { data, error: signErr } = await supa.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      if (!data.session && !data.user) {
        setError("signup failed — try again");
        return;
      }
      // If email confirmation is enabled, data.session is null but data.user exists.
      // For demo, we treat this as success and advance — user can confirm later.
      await onSignedUp();
    } catch (e: any) {
      setError(e?.message ?? "signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            create your account
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[48px]">
            Set up Kali for your nonprofit{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">in 4 minutes.</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            We'll connect to your existing tools, index your historical data, and have your team asking questions in plain English by the end of this flow.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
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
          <Field label="Password" hint="8+ characters">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          {error && (
            <div className="rounded border border-[var(--strawberry-deep)]/30 bg-[var(--strawberry-soft)]/30 px-3 py-2 text-[13px] text-[var(--strawberry-deep)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password || !name}
            className="mt-2 self-start rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "creating…" : "continue →"}
          </button>
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
