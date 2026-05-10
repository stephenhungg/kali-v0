"use client";

import { useState } from "react";
import { CuteButton, CuteCard, CutePill } from "@/components/kawaii/CutePrimitives";
import { Mascot } from "@/components/kawaii/Mascot";

export function LaunchCoinFormStandalone({ defaultTenantSlug }: { defaultTenantSlug: string }) {
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
      <div className="kawaii-mono-tag">launch parameters</div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}
      >
        <Field label="symbol — 2 to 8 caps">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            maxLength={8}
            placeholder="RVRT"
            style={inputStyle({ size: 18, weight: 800, color: "var(--matcha-deep-warm)" })}
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
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="cause description (optional)">
          <input
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="Sacramento community foundation — six core programs"
            style={inputStyle({})}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Field label={`trading fee · ${feeBps / 100}%`}>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={feeBps}
            onChange={(e) => setFeeBps(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--sakura)" }}
          />
        </Field>
        <Field label={`community fund · ${communityFundBps / 100}% of fee`}>
          <input
            type="range"
            min={0}
            max={5000}
            step={500}
            value={communityFundBps}
            onChange={(e) => setCommunityFundBps(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--matcha)" }}
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
          {submitting ? "deploying…" : `deploy $${symbol || "TOKEN"} on ${tenantSlug}`}
        </CuteButton>
      </div>

      {log.length > 0 && (
        <CuteCard tone="paper" style={{ marginTop: 16, padding: "14px 16px" }}>
          <div className="kawaii-mono-tag" style={{ marginBottom: 8 }}>
            deploy log
          </div>
          <pre
            className="kawaii-mono-surface"
            style={{
              maxHeight: 240,
              overflowY: "auto",
              margin: 0,
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            {log.join("\n")}
          </pre>
        </CuteCard>
      )}

      {result && (
        <CuteCard tone="matcha" accent="sparkle" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Mascot pose="cheer" size={64} tiltDeg={-3} />
            <div>
              <div className="kawaii-mono-tag" style={{ color: "var(--matcha-deep-warm)" }}>
                ✓ live
              </div>
              <div
                className="kawaii-display"
                style={{ fontSize: 24, color: "var(--matcha-deep-warm)" }}
              >
                ${result.symbol} deployed
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink)", margin: 0 }}>{result.message}</p>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <CuteButton href={`/coin/${tenantSlug}`} tone="sakura" size="sm">
              open trading page →
            </CuteButton>
            <CuteButton href={result.explorerUrls.mint} tone="ghost" size="sm">
              view mint ↗
            </CuteButton>
            <CuteButton href={result.explorerUrls.pool} tone="ghost" size="sm">
              view pool ↗
            </CuteButton>
            {result.explorerUrls.deployTx && (
              <CutePill tone="matcha">live onchain</CutePill>
            )}
          </div>
        </CuteCard>
      )}
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

function inputStyle({
  size = 14,
  weight = 600,
  color,
}: {
  size?: number;
  weight?: number;
  color?: string;
}) {
  return {
    width: "100%",
    background: "white",
    border: "2px solid white",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: size,
    color: color ?? "var(--ink)",
    outline: "none",
    boxShadow: "1px 2px 0 var(--sticker-shadow)",
    fontFamily: 'var(--font-quicksand), "Quicksand", "Inter", system-ui, sans-serif',
    fontWeight: weight,
  } as React.CSSProperties;
}
