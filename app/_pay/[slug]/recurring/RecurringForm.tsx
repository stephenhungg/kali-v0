"use client";

import { useState } from "react";

export function RecurringForm({
  tenantSlug,
  programs,
}: {
  tenantSlug: string;
  programs: string[];
}) {
  const [amount, setAmount] = useState(25);
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [program, setProgram] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [response, setResponse] = useState<{
    subscriptionId: string;
    nextChargeAt: string;
    period: string;
    amountUsdc: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStatus("submitting");
    setError(null);
    try {
      // In demo mode we generate a stub delegation proof. Real flow: Privy
      // hosts a signing modal that returns a real Ed25519-signed proof.
      const stubProof = {
        userId: `demo_user_${Date.now().toString(36)}`,
        walletPubkey: "8DemoBoundWallet11111111111111111111111111",
        scope: "donate",
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        nonce: Math.random().toString(36).slice(2),
        signature: "z" + Math.random().toString(36).slice(2, 88).padEnd(86, "x"),
      };

      const res = await fetch(`/api/x402/${tenantSlug}/recurring`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountUsdc: amount,
          period,
          payerWallet: stubProof.walletPubkey,
          delegationProof: stubProof,
          memo: memo.trim() || undefined,
          programDesignation: program || undefined,
        }),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}: ${await res.text()}`);
        setStatus("error");
        return;
      }
      const data = (await res.json()) as {
        subscriptionId: string;
        nextChargeAt: string;
        period: string;
        amountUsdc: number;
      };
      setResponse(data);
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "submission failed");
      setStatus("error");
    }
  }

  if (status === "success" && response) {
    return (
      <div className="chat-card mt-10 p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--matcha-mid)]">
          subscribed
        </div>
        <div className="r-display mt-3 text-3xl">
          ${response.amountUsdc} / {response.period}
        </div>
        <div className="mt-1 text-sm opacity-70">
          next charge: {new Date(response.nextChargeAt).toLocaleString()}
        </div>
        <div className="mt-4 break-all rounded bg-[var(--mint-pale)] px-3 py-2 font-mono text-xs">
          subscription id · {response.subscriptionId}
        </div>
        <div className="mt-6 flex gap-3">
          <a
            href={`/${tenantSlug}`}
            className="rounded bg-[var(--matcha-deep)] px-4 py-2 text-sm text-[var(--cream)]"
          >
            done
          </a>
          <button
            onClick={() => {
              setStatus("idle");
              setResponse(null);
            }}
            className="rounded border border-[var(--mint-line)] px-4 py-2 text-sm"
          >
            set up another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-card mt-10 p-6">
      <Field label="Amount (USDC)">
        <div className="flex items-center gap-2">
          {[10, 25, 50, 100, 250].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`rounded border px-4 py-2 text-sm transition ${
                amount === v
                  ? "border-[var(--matcha-deep)] bg-[var(--matcha-deep)] text-[var(--cream)]"
                  : "border-[var(--mint-line)] hover:bg-[var(--mint-pale)]"
              }`}
            >
              ${v}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            className="ml-auto w-24 rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-right font-mono text-sm"
          />
        </div>
      </Field>

      <Field label="Period">
        <div className="flex gap-2">
          {(["monthly", "weekly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded border px-4 py-2 text-sm transition ${
                period === p
                  ? "border-[var(--matcha-deep)] bg-[var(--matcha-deep)] text-[var(--cream)]"
                  : "border-[var(--mint-line)] hover:bg-[var(--mint-pale)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Program (optional)">
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          className="w-full rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">— general support —</option>
          {programs.map((p) => (
            <option key={p} value={p.toLowerCase().replace(/\s+/g, "-")}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Memo (optional)">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="e.g. Climate giving subscription via Claude"
          className="w-full rounded border border-[var(--mint-line)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </Field>

      {error && (
        <div className="mt-4 rounded border border-[var(--strawberry-deep)] bg-[var(--strawberry-soft)] px-3 py-2 text-sm text-[var(--strawberry-deep)]">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={status === "submitting"}
        className="mt-6 w-full rounded bg-[var(--matcha-deep)] px-6 py-3 text-[var(--cream)] disabled:opacity-50"
      >
        {status === "submitting"
          ? "submitting…"
          : `Subscribe — $${amount} / ${period}`}
      </button>

      <p className="mt-4 text-[11px] opacity-60">
        By subscribing you authorize Kali to charge USDC at the specified period using a Privy
        delegation. The delegation expires in 1 year and can be revoked any time. Receipts are
        tax-deductible because the delegation binds the payer wallet to your verified identity.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
