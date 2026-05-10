"use client";

import { useState } from "react";
import type { StepProps } from "./OnboardingShell";
import type { BudgetBracket } from "../../lib/supabase/types";
import { Field, SidebarNote } from "./Step1_Signup";

const BUDGET_OPTIONS: Array<{ id: BudgetBracket; label: string; sub: string }> = [
  { id: "under_500k", label: "Under $500K", sub: "small grassroots" },
  { id: "500k_2m", label: "$500K – $2M", sub: "growing org" },
  { id: "2m_10m", label: "$2M – $10M", sub: "established foundation" },
  { id: "over_10m", label: "$10M+", sub: "regional / national" },
];

export function Step2Profile({ state, setState, next, back }: StepProps) {
  const [name, setName] = useState(state.tenant?.name ?? "");
  const [ein, setEin] = useState(state.tenant?.ein ?? "");
  const [mission, setMission] = useState(state.tenant?.mission ?? "");
  const [city, setCity] = useState(state.tenant?.city ?? "");
  const [stateAbbr, setStateAbbr] = useState(state.tenant?.state ?? "");
  const [budgetBracket, setBudget] = useState<BudgetBracket | undefined>(state.tenant?.budgetBracket);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2 && !!budgetBracket;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    await setState({
      tenant: {
        name: name.trim(),
        ein: ein.trim() || undefined,
        mission: mission.trim() || undefined,
        city: city.trim() || undefined,
        state: stateAbbr.trim().toUpperCase().slice(0, 2) || undefined,
        budgetBracket,
      },
    });
    await next();
  };

  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            tell us about your nonprofit
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[44px]">
            Who you are{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">+ what you do.</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            We use this to personalize Kali's reasoning. Your mission goes into the system prompt so answers reference your actual programs.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Organization name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rivertown Community Foundation"
              required
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field label="EIN" hint="optional, used for IRS records">
            <input
              type="text"
              value={ein}
              onChange={(e) => setEin(formatEin(e.target.value))}
              placeholder="12-3456789"
              maxLength={10}
              className={inputClass + " font-mono"}
            />
          </Field>
          <Field label="Mission" hint="one line">
            <input
              type="text"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Strengthen our community by funding youth education and food security."
              maxLength={140}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="City">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Sacramento"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="State">
              <input
                type="text"
                value={stateAbbr}
                onChange={(e) => setStateAbbr(e.target.value)}
                placeholder="CA"
                maxLength={2}
                className={inputClass + " uppercase"}
              />
            </Field>
          </div>
          <Field label="Annual budget">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BUDGET_OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setBudget(o.id)}
                  className={`flex flex-col items-start gap-0.5 rounded border px-3 py-2.5 text-left transition-all ${
                    budgetBracket === o.id
                      ? "border-[var(--matcha-mid)] bg-[var(--mint-pale)]"
                      : "border-[var(--mint-line)] bg-[var(--surface)] hover:border-[var(--matcha-mid)]"
                  }`}
                >
                  <span className="text-[13px] font-medium text-[var(--matcha-deep)]">{o.label}</span>
                  <span className="font-mono text-[10px] text-[var(--gray-ink)]">{o.sub}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]"
            >
              ← back
            </button>
            <button
              type="submit"
              disabled={!valid || busy}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "saving…" : "continue →"}
            </button>
          </div>
        </form>
      </div>

      <SidebarNote
        title="What we do with this"
        body="Mission goes into Kali's system prompt — when you ask 'what programs are at risk,' it knows the actual programs you run. EIN is for matching against grant deadlines later."
      />
    </div>
  );
}

const inputClass =
  "kali-cute-input w-full rounded-xl border-[2px] border-white bg-white px-4 py-2.5 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--sakura)]";

function formatEin(s: string): string {
  const digits = s.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "-" + digits.slice(2);
}
