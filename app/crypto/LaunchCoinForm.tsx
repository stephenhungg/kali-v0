"use client";

import { useState } from "react";

interface CurrentCoin {
  symbol: string;
  mint: string;
  bondingCurvePool: string;
  treasuryWallet: string;
  mintExplorer: string;
  poolExplorer: string;
  tradeUrl: string;
}

export function LaunchCoinForm({
  tenantSlug,
  tenantName,
  currentCoin,
}: {
  tenantSlug: string;
  tenantName: string;
  currentCoin: CurrentCoin | null;
}) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [cause, setCause] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    coinId: string;
    mint: string;
    symbol: string;
    bondingCurvePool: string;
    treasuryWallet: string;
    explorerUrls: { mint: string; pool: string; deployTx: string | null };
    message: string;
  } | null>(null);

  if (currentCoin && !result) {
    return (
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-[#7fae7e]">
          ${currentCoin.symbol}
          <span className="ml-2 text-sm text-[#c8e6cb]/40">deployed</span>
        </div>
        <p className="mt-2 text-xs text-[#c8e6cb]/60">
          {tenantName} already has a cause coin live. One coin per tenant in v1 — to relaunch,
          reset the in-memory store via{" "}
          <code className="rounded bg-black/40 px-1">bun run seed:causecoin</code>.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 text-xs">
          <KV label="mint" value={currentCoin.mint} link={currentCoin.mintExplorer} />
          <KV label="bonding pool" value={currentCoin.bondingCurvePool} link={currentCoin.poolExplorer} />
          <KV label="treasury" value={currentCoin.treasuryWallet} />
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={currentCoin.tradeUrl}
            className="rounded bg-[#1d3a2a] px-4 py-2 text-xs uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638]"
          >
            open trading page →
          </a>
          <a
            href={currentCoin.mintExplorer}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-[#1a2421] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#1a2421]"
          >
            view on explorer ↗
          </a>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-[#7fae7e]">
          ${result.symbol} deployed
        </div>
        <p className="mt-2 text-xs text-[#c8e6cb]/60">{result.message}</p>

        <div className="mt-6 grid grid-cols-1 gap-3 text-xs">
          <KV label="mint" value={result.mint} link={result.explorerUrls.mint} />
          <KV
            label="bonding pool"
            value={result.bondingCurvePool}
            link={result.explorerUrls.pool}
          />
          <KV label="treasury" value={result.treasuryWallet} />
          {result.explorerUrls.deployTx && (
            <KV
              label="deploy tx"
              value="on-chain"
              link={result.explorerUrls.deployTx}
            />
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={`/coin/${tenantSlug}`}
            className="rounded bg-[#1d3a2a] px-4 py-2 text-xs uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638]"
          >
            open trading page →
          </a>
          <button
            onClick={() => {
              setResult(null);
              setSymbol("");
              setName("");
              setCause("");
            }}
            className="rounded border border-[#1a2421] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#1a2421]"
          >
            launch another
          </button>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!symbol || !name) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/coin/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          symbol: symbol.toUpperCase(),
          name,
          cause: cause || undefined,
        }),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}: ${await res.text()}`);
        setSubmitting(false);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "launch failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="text-2xl font-semibold tracking-tight">launch cause coin</div>
      <p className="mt-2 text-xs text-[#c8e6cb]/60">
        deploy an SPL token + meteora bonding curve for {tenantName}. all fields persist into
        onchain metadata via the kali_tenant_id pointer.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="symbol — 2 to 8 caps">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            maxLength={8}
            placeholder="RVRT"
            className="w-full rounded border border-[#1a2421] bg-[#050807] px-3 py-2 font-mono text-base text-[#7fae7e] focus:border-[#7fae7e] focus:outline-none"
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
        <Field label="cause (optional)">
          <input
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="Sacramento community foundation — six core programs"
            className="w-full rounded border border-[#1a2421] bg-[#050807] px-3 py-2 text-sm focus:border-[#7fae7e] focus:outline-none"
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
        className="mt-6 w-full rounded bg-[#1d3a2a] px-6 py-3 text-sm uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638] disabled:opacity-40"
      >
        {submitting ? "deploying…" : `launch $${symbol || "TOKEN"}`}
      </button>

      <p className="mt-4 text-[10px] text-[#c8e6cb]/40">
        24h cooling-off recommended before mainnet. devnet deploys are instant. zero insider
        allocation, fee recipient is the tenant treasury (audit-able onchain).
      </p>
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

function KV({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#c8e6cb]/50">{label}</span>
      <code className="break-all text-[#7fae7e]">{value}</code>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-[#5fa088] underline-offset-2 hover:underline"
        >
          ↗
        </a>
      )}
    </div>
  );
}
