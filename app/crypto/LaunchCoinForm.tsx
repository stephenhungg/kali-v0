"use client";

import { useState } from "react";
import { CuteButton } from "@/components/kawaii/CutePrimitives";
import { Mascot } from "@/components/kawaii/Mascot";

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
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Mascot pose="cheer" size={88} tiltDeg={-4} />
          <div>
            <div
              className="kawaii-display"
              style={{ fontSize: 30, color: "var(--matcha-deep-warm)", lineHeight: 1.1 }}
            >
              ${currentCoin.symbol}
              <span style={{ marginLeft: 10, fontSize: 14, color: "var(--mute)", fontWeight: 600 }}>
                deployed
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--mute)" }}>
              {tenantName} already has a cause coin live. one coin per tenant in v1.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <KV label="mint" value={currentCoin.mint} link={currentCoin.mintExplorer} />
          <KV
            label="bonding pool"
            value={currentCoin.bondingCurvePool}
            link={currentCoin.poolExplorer}
          />
          <KV label="treasury" value={currentCoin.treasuryWallet} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <CuteButton href={currentCoin.tradeUrl} tone="sakura">
            open trading page →
          </CuteButton>
          <CuteButton href={currentCoin.mintExplorer} tone="ghost">
            view on explorer ↗
          </CuteButton>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Mascot pose="cheer" size={88} tiltDeg={-4} />
          <div>
            <div
              className="kawaii-display"
              style={{ fontSize: 30, color: "var(--matcha-deep-warm)", lineHeight: 1.1 }}
            >
              ${result.symbol} deployed
            </div>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--mute)" }}>{result.message}</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <KV label="mint" value={result.mint} link={result.explorerUrls.mint} />
          <KV
            label="bonding pool"
            value={result.bondingCurvePool}
            link={result.explorerUrls.pool}
          />
          <KV label="treasury" value={result.treasuryWallet} />
          {result.explorerUrls.deployTx && (
            <KV label="deploy tx" value="on-chain" link={result.explorerUrls.deployTx} />
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <CuteButton href={`/coin/${tenantSlug}`} tone="sakura">
            open trading page →
          </CuteButton>
          <CuteButton
            tone="ghost"
            onClick={() => {
              setResult(null);
              setSymbol("");
              setName("");
              setCause("");
            }}
          >
            launch another
          </CuteButton>
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
    <div style={{ marginTop: 8 }}>
      <div
        className="kawaii-display"
        style={{ fontSize: 28, color: "var(--ink)", lineHeight: 1.1, marginTop: 6 }}
      >
        launch a cause coin
      </div>
      <p style={{ marginTop: 6, fontSize: 13, color: "var(--mute)", maxWidth: 560 }}>
        deploy an SPL Token-2022 mint for {tenantName}. all fields persist into onchain metadata.
      </p>

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <Field label="symbol — 2 to 8 caps">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            maxLength={8}
            placeholder="RVRT"
            style={inputStyle({ size: 18, fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif' })}
          />
        </Field>
        <Field label="display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="Rivertown"
            style={inputStyle({})}
          />
        </Field>
        <Field label="cause (optional)">
          <input
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="Sacramento community foundation — six core programs"
            style={inputStyle({})}
          />
        </Field>
      </div>

      {error && (
        <div
          style={{
            marginTop: 14,
            background: "var(--mochi)",
            color: "var(--strawberry-deep)",
            border: "2px solid white",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "1px 2px 0 var(--sticker-shadow)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <CuteButton
          tone="sakura"
          size="lg"
          onClick={submit}
          disabled={!symbol || !name || submitting}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {submitting ? "deploying…" : `launch $${symbol || "TOKEN"}`}
        </CuteButton>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: "var(--mute)", lineHeight: 1.5 }}>
        24h cooling-off recommended before mainnet. devnet deploys are instant. zero insider
        allocation, fee recipient is the tenant treasury (auditable onchain).
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kawaii-mono-tag" style={{ color: "var(--mute)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function inputStyle({ size = 14, fontFamily }: { size?: number; fontFamily?: string }) {
  return {
    width: "100%",
    background: "white",
    border: "2px solid white",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: size,
    color: "var(--ink)",
    outline: "none",
    boxShadow: "1px 2px 0 var(--sticker-shadow)",
    fontFamily: fontFamily ?? 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
    fontWeight: 600,
  } as React.CSSProperties;
}

function KV({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr auto",
        alignItems: "center",
        gap: 12,
        background: "white",
        border: "2px solid white",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "1px 2px 0 var(--sticker-shadow)",
      }}
    >
      <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
        {label}
      </span>
      <code
        style={{
          fontFamily: "var(--font-mono-geist), monospace",
          fontSize: 12,
          color: "var(--ink)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </code>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--sakura)", fontWeight: 700, textDecoration: "none" }}
        >
          ↗
        </a>
      )}
    </div>
  );
}
