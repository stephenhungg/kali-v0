"use client";

import { useEffect, useMemo, useState } from "react";
import { CONNECTOR_DISPLAYS, type ConnectorDisplay, type ConnectorDomain } from "../../lib/connectors/status";
import type { StepProps } from "./OnboardingShell";
import { SidebarNote } from "./Step1_Signup";

const DOMAIN_GROUPS: Array<{ domain: ConnectorDomain | "_other"; label: string }> = [
  { domain: "donor", label: "Donor & CRM" },
  { domain: "comms", label: "Email & calendar" },
  { domain: "docs", label: "Documents" },
  { domain: "finance", label: "Accounting" },
  { domain: "grants", label: "Grants" },
  { domain: "meetings", label: "Meetings" },
  { domain: "workflow", label: "Workflows" },
  { domain: "analytics", label: "Analytics" },
  { domain: "security", label: "Security" },
  { domain: "payouts", label: "Payouts" },
  { domain: "marketing", label: "Marketing" },
];

const DEFAULT_BY_BUDGET: Record<string, string[]> = {
  under_500k: ["bloomerang", "m365", "quickbooks"],
  "500k_2m": ["bloomerang", "salesforce", "m365", "quickbooks"],
  "2m_10m": ["salesforce", "m365", "sharepoint", "quickbooks", "instrumentl"],
  over_10m: ["salesforce", "m365", "sharepoint", "quickbooks", "instrumentl", "powerbi"],
};

const MIN_REQUIRED = 3;

export function Step3StackPicker({ state, setState, next, back }: StepProps) {
  // Default selections based on org budget bracket from step 2.
  const defaults = useMemo(() => {
    if (state.selectedConnectors && state.selectedConnectors.length > 0) {
      return state.selectedConnectors;
    }
    return DEFAULT_BY_BUDGET[state.tenant?.budgetBracket ?? ""] ?? ["bloomerang", "m365", "quickbooks"];
  }, [state.selectedConnectors, state.tenant?.budgetBracket]);

  const [selected, setSelected] = useState<Set<string>>(new Set(defaults));

  useEffect(() => {
    // Animate cards in once on mount via row-rise class — already in globals.
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, ConnectorDisplay[]>();
    for (const c of CONNECTOR_DISPLAYS) {
      const group = DOMAIN_GROUPS.find(g => g.domain === c.domain) ?? { label: "Other" };
      const arr = m.get(group.label) ?? [];
      arr.push(c);
      m.set(group.label, arr);
    }
    // Stable order matching DOMAIN_GROUPS.
    return DOMAIN_GROUPS
      .map(g => ({ label: g.label, items: m.get(g.label) ?? [] }))
      .filter(g => g.items.length > 0);
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const out = new Set(prev);
      if (out.has(id)) out.delete(id);
      else out.add(id);
      return out;
    });
  };

  const submit = async () => {
    if (selected.size < MIN_REQUIRED) return;
    await setState({ selectedConnectors: Array.from(selected) });
    await next();
  };

  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            pick your stack
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[44px]">
            Which tools do{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">you</span> actually use?
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            We pre-selected the typical stack for a {budgetLabel(state.tenant?.budgetBracket)} nonprofit. Adjust to match yours. {selected.size < MIN_REQUIRED ? `Pick at least ${MIN_REQUIRED}.` : `${selected.size} selected.`}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {grouped.map(group => (
            <section key={group.label}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map(c => (
                  <ConnectorOption
                    key={c.id}
                    connector={c}
                    selected={selected.has(c.id)}
                    onToggle={() => toggle(c.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]"
          >
            ← back
          </button>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-[var(--gray-ink)]">
              {selected.size} of {CONNECTOR_DISPLAYS.length} · min {MIN_REQUIRED}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={selected.size < MIN_REQUIRED}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              continue →
            </button>
          </div>
        </div>
      </div>

      <SidebarNote
        title="Don't see your tool?"
        body="We support the 11 most common nonprofit SaaS tools at v1. If yours isn't here, we'll add it during your first onboarding call. Mailchimp, DonorPerfect, Neon CRM are next up."
      />
    </div>
  );
}

function ConnectorOption({
  connector,
  selected,
  onToggle,
}: {
  connector: ConnectorDisplay;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-3 rounded border px-3 py-2.5 text-left transition-all ${
        selected
          ? "border-[var(--matcha-mid)] bg-[var(--mint-pale)]"
          : "border-[var(--mint-line)] bg-[var(--surface)] hover:border-[var(--matcha-mid)]"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded font-display text-[16px] font-medium"
        style={{
          background: selected ? "var(--matcha-mid)" : "var(--surface-raised)",
          color: selected ? "var(--cream)" : "var(--matcha-deep)",
        }}
      >
        {connector.monogram}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-[var(--matcha-deep)]">
          {connector.label}
        </span>
        <span className="block text-[11px] leading-snug text-[var(--gray-ink)]">
          {connector.blurb}
        </span>
      </span>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
          selected ? "border-[var(--matcha-mid)] bg-[var(--matcha-mid)]" : "border-[var(--mint-line)]"
        }`}
        aria-hidden
      >
        {selected && (
          <svg viewBox="0 0 8 8" className="h-2 w-2 fill-[var(--cream)]">
            <path d="M0 4 L3 7 L8 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        )}
      </span>
    </button>
  );
}

function budgetLabel(b?: string): string {
  switch (b) {
    case "under_500k": return "smaller";
    case "500k_2m": return "growing";
    case "2m_10m": return "mid-sized";
    case "over_10m": return "larger";
    default: return "typical";
  }
}
