"use client";

import { useMemo, useState } from "react";
import { findDisplay, type ConnectorDisplay } from "../../lib/connectors/status";
import { MockOAuthModal } from "../chat/MockOAuthModal";
import type { StepProps } from "./OnboardingShell";
import { SidebarNote } from "./Step1_Signup";

export function Step4Connect({ state, setState, next, back, skip }: StepProps) {
  const selected = state.selectedConnectors ?? [];
  const [connected, setConnected] = useState<Set<string>>(new Set(state.connectedConnectors ?? []));
  const [activeModal, setActiveModal] = useState<ConnectorDisplay | null>(null);
  const [busy, setBusy] = useState(false);

  const tiles = useMemo(() => selected.map(id => findDisplay(id)).filter(Boolean) as ConnectorDisplay[], [selected]);
  const allDone = tiles.every(t => connected.has(t.id));

  const onConnectComplete = async (id: string) => {
    setActiveModal(null);
    const next = new Set(connected);
    next.add(id);
    setConnected(next);
    await setState({ connectedConnectors: Array.from(next) });
  };

  const advance = async () => {
    setBusy(true);
    await setState({ connectedConnectors: Array.from(connected) });
    await next();
  };

  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
            connect each tool
          </span>
          <h1 className="r-display text-[36px] font-medium leading-[0.95] tracking-tight text-[var(--matcha-deep)] sm:text-[44px]">
            Plug them in.{" "}
            <span className="r-italic font-light text-[var(--matcha-mid)]">{connected.size}/{tiles.length}</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--matcha-deep)]/70">
            One-click OAuth for each. Read-only — Kali never writes back to your systems. You can skip any to come back later from the dashboard.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {tiles.map(t => (
            <ConnectRow
              key={t.id}
              connector={t}
              connected={connected.has(t.id)}
              onConnect={() => setActiveModal(t)}
            />
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            className="font-mono text-[11px] text-[var(--gray-ink)] hover:text-[var(--matcha-deep)]"
          >
            ← back
          </button>
          <div className="flex items-center gap-3">
            {!allDone && (
              <button
                type="button"
                onClick={skip}
                className="font-mono text-[11px] text-[var(--gray-ink)] underline-offset-2 hover:text-[var(--matcha-deep)] hover:underline"
              >
                skip remaining
              </button>
            )}
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className="rounded bg-[var(--matcha-deep)] px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--cream)] transition-transform hover:scale-[1.02] disabled:opacity-40"
            >
              {busy ? "saving…" : allDone ? "all set →" : "continue →"}
            </button>
          </div>
        </div>
      </div>

      <SidebarNote
        title="Read-only, by design"
        body="In v1, Kali never writes back to your systems. We only read. Action loops (drafting an email, scheduling a follow-up) come in v1.5 with explicit confirmation per action."
      />

      {activeModal && (
        <MockOAuthModal
          connector={activeModal}
          onClose={() => onConnectComplete(activeModal.id)}
        />
      )}
    </div>
  );
}

function ConnectRow({
  connector,
  connected,
  onConnect,
}: {
  connector: ConnectorDisplay;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <li
      className={`row-rise flex items-center gap-3 rounded border px-3 py-2.5 transition-all ${
        connected
          ? "border-[var(--matcha-mid)] bg-[var(--mint-pale)]"
          : "border-[var(--mint-line)] bg-[var(--surface)]"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded font-display text-[16px] font-medium"
        style={{
          background: connected ? "var(--matcha-mid)" : "var(--surface-raised)",
          color: connected ? "var(--cream)" : "var(--matcha-deep)",
        }}
      >
        {connector.monogram}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-[var(--matcha-deep)]">{connector.label}</span>
        <span className="block text-[11px] text-[var(--gray-ink)]">{connector.vendor}</span>
      </span>
      {connected ? (
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--matcha-mid)]">
          ✓ connected
        </span>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          className="rounded border border-[var(--matcha-mid)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--matcha-mid)] transition-colors hover:bg-[var(--matcha-mid)] hover:text-[var(--cream)]"
        >
          connect
        </button>
      )}
    </li>
  );
}
