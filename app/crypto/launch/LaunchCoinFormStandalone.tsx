"use client";

import { useState } from "react";

export function LaunchCoinFormStandalone({
  defaultTenantSlug,
}: {
  defaultTenantSlug: string;
}) {
  const [tenantSlug] = useState(defaultTenantSlug);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [cause, setCause] = useState("");
  const [feeBps, setFeeBps] = useState(100);
  const [communityFundBps, setCommunityFundBps] = useState(2000);
  const [submitting, setSubmitting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{
    coinId: string;
    mint: string;
    symbol: string;
    bondingCurvePool: string;
    treasuryWallet: string;
    explorerUrls: { mint: string; pool: string; deployTx: string | null };
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function appendLog(line: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} · ${line}`]);
  }

  async function submit() {
    if (!symbol || !name) return;
    setSubmitting(true);
    setError(null);
    setLog([]);
    appendLog(`POST /api/coin/launch · symbol=${symbol} name="${name}"`);
    try {
      const res = await fetch("/api/coin/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          symbol: symbol.toUpperCase(),
          name,
          cause: cause || undefined,
          feeBps,
          communityFundBps,
        }),
      });
      appendLog(`response · ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const txt = await res.text();
        appendLog(`error body · ${txt.slice(0, 240)}`);
        setError(`HTTP ${res.status}: ${txt}`);
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as Awaited<ReturnType<typeof Promise.resolve<typeof result>>>;
      if (!data) {
        setError("empty response");
        setSubmitting(false);
        return;
      }
      appendLog(`mint · ${data.mint}`);
      appendLog(`pool · ${data.bondingCurvePool}`);
      appendLog(`treasury · ${data.treasuryWallet}`);
      if (data.explorerUrls.deployTx) appendLog(`deploy tx · live onchain`);
      else appendLog(`mode · simulated (set KALI_SOLANA_DEVNET_SECRET_KEY for live deploy)`);
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "launch failed";
      appendLog(`exception · ${msg}`);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
        launch parameters
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="symbol — 2 to 8 caps">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            maxLength={8}
            placeholder="RVRT"
            className="w-full rounded border border-[#1a2421] bg-[#050807] px-3 py-2 text-base font-semibold text-[#7fae7e] focus:border-[#7fae7e] focus:outline-none"
          />
        </Field>
        <Field label="display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="Rivertown"
            className="w-full rounded border border-[#1a2421] bg-[#050807] px-3 py-2 text-sm focus:border-[#7fae7e] focus:outline-none"
          />
        </Field>
      </div>

      <Field label="cause description (optional)">
        <input
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder="Sacramento community foundation — six core programs"
          className="mt-1.5 w-full rounded border border-[#1a2421] bg-[#050807] px-3 py-2 text-sm focus:border-[#7fae7e] focus:outline-none"
        />
      </Field>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label={`trading fee (bps · ${feeBps / 100}%)`}>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={feeBps}
            onChange={(e) => setFeeBps(Number(e.target.value))}
            className="w-full"
          />
        </Field>
        <Field label={`community fund split (${communityFundBps / 100}% of fee)`}>
          <input
            type="range"
            min={0}
            max={5000}
            step={500}
            value={communityFundBps}
            onChange={(e) => setCommunityFundBps(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-4 rounded border border-[#5a2a2a] bg-[#2a0e0e] px-3 py-2 text-xs text-[#e88a8a]">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!symbol || !name || submitting}
        className="mt-6 w-full rounded bg-[#1d3a2a] px-6 py-4 text-sm uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638] disabled:opacity-40"
      >
        {submitting ? "deploying…" : `deploy $${symbol || "TOKEN"} on ${tenantSlug}`}
      </button>

      {log.length > 0 && (
        <div className="mt-6 rounded border border-[#1a2421] bg-[#050807] p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
            deploy log
          </div>
          <pre className="mt-2 max-h-[280px] overflow-y-auto text-[11px] text-[#c8e6cb]/80">
            {log.join("\n")}
          </pre>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded border border-[#7fae7e]/30 bg-[#0d1f17] p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
            ✓ ${result.symbol} live
          </div>
          <p className="mt-2 text-xs text-[#c8e6cb]/70">{result.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/coin/${tenantSlug}`}
              className="rounded bg-[#1d3a2a] px-4 py-2 text-xs uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638]"
            >
              open trading page →
            </a>
            <a
              href={result.explorerUrls.mint}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#1a2421] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#1a2421]"
            >
              view mint ↗
            </a>
            <a
              href={result.explorerUrls.pool}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#1a2421] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#1a2421]"
            >
              view pool ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#c8e6cb]/50">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
