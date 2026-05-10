"use client";

import { useEffect, useState } from "react";
import type { ConnectorDisplay } from "../../lib/connectors/status";

type Step = "intro" | "auth" | "scopes" | "syncing" | "done";

interface MockOAuthModalProps {
  connector: ConnectorDisplay;
  onClose: () => void;
}

const SCOPES_BY_VENDOR: Record<string, string[]> = {
  Bloomerang: ["read constituents", "read transactions", "read engagement"],
  Salesforce: ["read contacts", "read accounts", "read opportunities"],
  Microsoft: ["read mail (delegated)", "read calendar", "read drive"],
  Instrumentl: ["read tracked grants", "read funder profiles"],
  Intuit: ["read company info", "read transactions", "read budgets"],
  Zoom: ["read meetings", "read recordings", "read transcripts"],
  KnowBe4: ["read user risk scores", "read training records"],
  DonorPerfect: ["read constituent records", "read gift history"],
  default: ["read records", "read activity"],
};

export function MockOAuthModal({ connector, onClose }: MockOAuthModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const scopes = SCOPES_BY_VENDOR[connector.vendor] ?? SCOPES_BY_VENDOR.default;

  useEffect(() => {
    if (step !== "syncing") return;
    const t = setTimeout(() => setStep("done"), 1500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[var(--matcha-deep)]/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md overflow-hidden rounded border border-[var(--mint-line)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--mint-line)] bg-[var(--mint-pale)]/30 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">demo · oauth flow preview</span>
          <button type="button" onClick={onClose} className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]">close</button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded font-display text-[22px] font-medium" style={{ background: "var(--matcha-mid)", color: "var(--cream)" }}>
              {connector.monogram}
            </span>
            <div>
              <h3 className="r-display text-[20px] font-medium tracking-tight text-[var(--matcha-deep)]">Connect to {connector.label}</h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">{connector.vendor}</p>
            </div>
          </div>

          <div className="mt-5">
            <Steps current={step} />
          </div>

          <div className="mt-5 min-h-[140px]">
            {step === "intro" && (
              <div className="space-y-3">
                <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]">
                  Kali will read records from your {connector.label} account and use them to answer questions across your stack. Read-only — Kali never writes back.
                </p>
                <p className="text-[12px] leading-relaxed text-[var(--gray-ink)]">
                  In production, this redirects to {connector.vendor}'s OAuth authorization page. For the demo, we simulate the round trip.
                </p>
              </div>
            )}

            {step === "auth" && (
              <div className="space-y-3">
                <div className="rounded border border-[var(--mint-line)] bg-[var(--mint-pale)]/40 p-3 font-mono text-[11px] text-[var(--matcha-deep)]">
                  https://auth.{connector.vendor.toLowerCase().replace(/\s+/g, "")}.com/oauth/authorize
                  ?client_id=kali_xyz123&redirect_uri=kalilabs.ai/oauth/callback&scope={scopes.length}+permissions
                </div>
                <p className="text-[12px] text-[var(--gray-ink)]">Sign in with your {connector.vendor} admin account.</p>
              </div>
            )}

            {step === "scopes" && (
              <div className="space-y-3">
                <p className="text-[13px] text-[var(--matcha-deep)]">Kali is requesting these permissions:</p>
                <ul className="space-y-1.5 rounded border border-[var(--mint-line)] bg-[var(--surface-raised)] p-3">
                  {scopes.map(s => (
                    <li key={s} className="flex items-center gap-2 text-[12px] text-[var(--matcha-deep)]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--matcha-mid)]" />
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[var(--gray-ink)]">Kali will never ask for write permissions in v1. We're read-only by design.</p>
              </div>
            )}

            {step === "syncing" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--mint-line)] border-t-[var(--matcha-mid)]" />
                <p className="text-[13px] text-[var(--matcha-deep)]">Syncing initial data…</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--gray-ink)]">fetching records · embedding chunks · building index</p>
              </div>
            )}

            {step === "done" && (
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--matcha-mid)] text-[var(--cream)]">✓</div>
                <p className="text-[15px] font-medium text-[var(--matcha-deep)]">Connected.</p>
                <p className="text-[12px] text-[var(--gray-ink)]">{connector.label} is now indexed. Ask Kali a question to see it in action.</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {step === "intro" && (
              <>
                <button onClick={onClose} className="rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]">cancel</button>
                <button onClick={() => setStep("auth")} className="rounded bg-[var(--matcha-deep)] px-3 py-1.5 text-[12px] text-[var(--cream)] hover:scale-[1.02]">begin</button>
              </>
            )}
            {step === "auth" && (
              <>
                <button onClick={() => setStep("intro")} className="rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]">back</button>
                <button onClick={() => setStep("scopes")} className="rounded bg-[var(--matcha-deep)] px-3 py-1.5 text-[12px] text-[var(--cream)] hover:scale-[1.02]">sign in</button>
              </>
            )}
            {step === "scopes" && (
              <>
                <button onClick={() => setStep("auth")} className="rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--matcha-deep)] hover:bg-[var(--mint-pale)]">back</button>
                <button onClick={() => setStep("syncing")} className="rounded bg-[var(--strawberry-deep)] px-3 py-1.5 text-[12px] text-[var(--cream)] hover:scale-[1.02]">authorize</button>
              </>
            )}
            {step === "done" && (
              <button onClick={onClose} className="rounded bg-[var(--matcha-deep)] px-3 py-1.5 text-[12px] text-[var(--cream)] hover:scale-[1.02]">done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["intro", "auth", "scopes", "syncing", "done"];
  const idx = order.indexOf(current);
  return (
    <div className="flex items-center gap-1.5">
      {order.map((s, i) => (
        <span
          key={s}
          className="h-1 flex-1 rounded-full transition-colors"
          style={{ background: i <= idx ? "var(--matcha-mid)" : "var(--mint-line)" }}
        />
      ))}
    </div>
  );
}
