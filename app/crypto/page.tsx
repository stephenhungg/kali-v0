/**
 * Crypto desk — kawaii edition. Pastel surface with mascot in chart pose,
 * sticker stat cards, sticker-style coin sticker, and a live treasury
 * ticker that pulses sakura on every recorded fee. Same grounded data as
 * before — only the dressing changes.
 */

import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack } from "@/lib/connectors/sync-state";
import { resolveTenant } from "@/lib/tenants";
import { listReceipts } from "@/lib/x402/receipt";
import {
  cumulativeFees,
  curveStateFor,
  listHolders,
  listTrades,
  loadCoinByTenant,
} from "@/lib/causecoin/trading";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { LaunchCoinForm } from "./LaunchCoinForm";
import { LiveTreasuryTicker } from "./LiveTreasuryTicker";
import {
  CuteCard,
  CuteButton,
  CuteStat,
  CutePill,
} from "@/components/kawaii/CutePrimitives";
import { Mascot } from "@/components/kawaii/Mascot";
import { StickerLogo } from "@/components/kawaii/StickerLogo";
import { StickerAccent } from "@/components/kawaii/StickerAccent";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";
const TENANT = "rivertown";

function shortAddr(s: string): string {
  return s.length <= 12 ? s : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function explorer(addr: string, kind: "tx" | "address" = "address"): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/${kind}/${addr}${cluster}`;
}

export default async function CryptoDashboard() {
  await initAllAndTrack(
    listConnectors().map((c) => ({ id: c.id, label: c.label, init: c.init })),
  );

  const tenant = await resolveTenant(TENANT);
  if (!tenant) return null;

  const allCoins = isMemoryMode() ? memoryStore.get("causeCoins") : [];
  const myCoin = loadCoinByTenant(tenant.id);
  const fees = myCoin ? cumulativeFees(myCoin.id) : null;
  const holders = myCoin ? listHolders(myCoin.id) : [];
  const recentTrades = myCoin ? listTrades(myCoin.id, 10) : [];
  const curve = myCoin ? curveStateFor(myCoin) : null;
  const price =
    curve && myCoin ? curve.config.initialPriceUsdc + curve.config.slope * curve.progression : 0;
  const marketCap = curve && myCoin ? price * curve.config.totalSupply : 0;

  const x402Recent = await listReceipts({ tenantId: tenant.id, windowDays: 30, limit: 10 });
  const x402Total = x402Recent.reduce((s, r) => s + r.amountUsdc, 0);

  return (
    <main className="kawaii-page">
      {/* header */}
      <header
        style={{
          borderBottom: "2px dashed var(--hair)",
          padding: "20px 0 18px",
        }}
      >
        <div className="mx-auto max-w-[1500px] px-6 sm:px-10">
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <StickerLogo size={64} />
            </Link>
            <span
              className="kawaii-display"
              style={{
                fontSize: 22,
                color: "var(--ink)",
                marginLeft: 4,
              }}
            >
              · crypto desk
            </span>
            <CutePill tone="lemon">{NETWORK}</CutePill>
            <CutePill tone="matcha">{tenant.name}</CutePill>
            <nav
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 14,
                alignItems: "center",
                fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <Link
                href="/crypto"
                style={{ color: "var(--ink)", textDecoration: "none" }}
              >
                overview
              </Link>
              <Link
                href="/crypto/launch"
                style={{ color: "var(--mute)", textDecoration: "none" }}
              >
                launch
              </Link>
              <Link
                href="/crypto/coins"
                style={{ color: "var(--mute)", textDecoration: "none" }}
              >
                all coins
              </Link>
              <CuteButton href="/dashboard" tone="ghost" size="sm">
                main →
              </CuteButton>
            </nav>
          </div>
        </div>
      </header>

      {/* live stat row + mascot */}
      <section className="mx-auto max-w-[1500px] px-6 py-8 sm:px-10">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              className="kawaii-display"
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                lineHeight: 1.0,
                color: "var(--ink)",
                margin: 0,
              }}
            >
              real{" "}
              <span style={{ color: "var(--sakura)", fontStyle: "italic" }}>
                onchain
              </span>{" "}
              · zero fluff
              <StickerAccent prop="sparkle" size={32} tiltDeg={20} style={{ marginLeft: 10 }} />
            </h1>
            <p style={{ color: "var(--mute)", fontSize: 14, marginTop: 8, maxWidth: 540 }}>
              SPL Token-2022 mints with onchain metadata. 1% trading fees route to the nonprofit's
              treasury. Every number below is computed from real data.
            </p>
          </div>
          <div className="hidden md:block">
            <Mascot pose="chart" size={130} tiltDeg={6} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <CuteStat
            label="x402 inflows · 30d"
            value={`$${x402Total.toFixed(2)}`}
            sub={`${x402Recent.length} receipts`}
            tone="mochi"
            accent="letter"
          />
          <CuteStat
            label={myCoin ? `${myCoin.symbol} treasury fees` : "no coin yet"}
            value={fees ? `$${fees.treasury.toFixed(2)}` : "—"}
            sub={myCoin ? `${holders.length} holders` : "deploy below"}
            tone="matcha"
            accent="matcha-bowl"
          />
          <CuteStat
            label={myCoin ? `${myCoin.symbol} market cap` : "—"}
            value={
              myCoin ? `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"
            }
            sub={myCoin ? `price $${price.toFixed(8)}` : "—"}
            tone="lemon"
            accent="coin"
          />
          <CuteStat
            label="all coins"
            value={`${allCoins.length}`}
            sub={`${allCoins.filter((c) => c.graduationStatus === "graduated").length} graduated`}
            tone="cloud"
            accent="cloud"
          />
        </div>

        {myCoin && (
          <div style={{ marginTop: 18 }}>
            <LiveTreasuryTicker
              mint={myCoin.mint}
              initial={fees ?? { treasury: 0, communityFund: 0, total: 0, tradeCount: 0 }}
              symbol={myCoin.symbol}
            />
          </div>
        )}
      </section>

      {/* launch + how-it-works */}
      <section className="mx-auto max-w-[1500px] px-6 pb-8 sm:px-10">
        <div
          className="crypto-launch-row"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 24,
          }}
        >
          <CuteCard tone="paper" accent="sparkle">
            <div className="kawaii-mono-tag" style={{ marginBottom: 4 }}>
              launch / manage
            </div>
            <LaunchCoinForm
              tenantSlug={tenant.slug}
              tenantName={tenant.name}
              currentCoin={
                myCoin
                  ? {
                      symbol: myCoin.symbol,
                      mint: myCoin.mint,
                      bondingCurvePool: myCoin.bondingCurvePool,
                      treasuryWallet: myCoin.treasuryWallet,
                      mintExplorer: explorer(myCoin.mint),
                      poolExplorer: explorer(myCoin.bondingCurvePool),
                      tradeUrl: `/coin/${tenant.slug}`,
                    }
                  : null
              }
            />
          </CuteCard>

          <CuteCard tone="cloud">
            <div className="kawaii-mono-tag" style={{ marginBottom: 8 }}>
              how it works
            </div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 12 }}>
              <Step n={1}>
                Pick a symbol + name. The SPL mint metadata embeds your EIN + IRS status onchain.
              </Step>
              <Step n={2}>
                Treasury / community-fund / platform-reserve wallets auto-derive from your tenant
                id (deterministic).
              </Step>
              <Step n={3}>
                Token-2022 mint deployed atomically with metadata pointer + 1B initial supply →
                treasury ATA.
              </Step>
              <Step n={4}>
                Live deploy when{" "}
                <code
                  style={{
                    background: "white",
                    border: "1px solid var(--hair)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontFamily: "var(--font-mono-geist), monospace",
                    fontSize: 11,
                  }}
                >
                  KALI_SOLANA_DEVNET_SECRET_KEY
                </code>{" "}
                is set + funder has ≥ 0.02 SOL.
              </Step>
              <Step n={5}>
                Public trading page at{" "}
                <code
                  style={{
                    background: "white",
                    border: "1px solid var(--hair)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontFamily: "var(--font-mono-geist), monospace",
                    fontSize: 11,
                  }}
                >
                  coin.kalilabs.ai/{tenant.slug}
                </code>
                .
              </Step>
            </ol>
          </CuteCard>
        </div>

        <style>{`
          @media (max-width: 980px) {
            .crypto-launch-row { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* recent inflows + trades */}
      <section className="mx-auto max-w-[1500px] px-6 pb-12 sm:px-10">
        <div
          className="crypto-feeds"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
        >
          <CuteCard tone="mochi" accent="letter">
            <div className="kawaii-mono-tag" style={{ marginBottom: 10 }}>
              x402 inflows · live
            </div>
            {x402Recent.length === 0 ? (
              <Empty msg="no donations yet — try `bun run x402:donate`" />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {x402Recent.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px dashed var(--hair)",
                    }}
                  >
                    <CutePill
                      tone={
                        r.attribution === "human"
                          ? "mochi"
                          : r.attribution === "autonomous"
                            ? "matcha"
                            : "neutral"
                      }
                    >
                      {r.attribution}
                    </CutePill>
                    <code
                      style={{
                        fontFamily: "var(--font-mono-geist), monospace",
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    >
                      {shortAddr(r.payerWallet)}
                    </code>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--matcha-deep-warm)" }}>
                      ${r.amountUsdc.toFixed(2)}
                    </span>
                    <a
                      href={explorer(r.txSignature, "tx")}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--sakura)", textDecoration: "none", fontSize: 14 }}
                    >
                      ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CuteCard>

          <CuteCard tone="lemon" accent={myCoin ? "coin" : "cloud"}>
            <div className="kawaii-mono-tag" style={{ marginBottom: 10 }}>
              {myCoin ? `${myCoin.symbol} trades · live` : "trades — launch a coin first"}
            </div>
            {!myCoin || recentTrades.length === 0 ? (
              <Empty msg={myCoin ? "no trades yet" : "deploy your coin to start"} />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {recentTrades.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px dashed var(--hair)",
                    }}
                  >
                    <CutePill tone={t.side === "buy" ? "matcha" : "sakura"}>{t.side}</CutePill>
                    <code
                      style={{
                        fontFamily: "var(--font-mono-geist), monospace",
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    >
                      {shortAddr(t.wallet)}
                    </code>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      ${t.usdcAmount.toFixed(2)}
                    </span>
                    <a
                      href={explorer(t.txSignature, "tx")}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--sakura)", textDecoration: "none", fontSize: 14 }}
                    >
                      ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CuteCard>

          <style>{`
            @media (max-width: 900px) {
              .crypto-feeds { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      </section>

      <footer
        className="mx-auto max-w-[1500px] px-6 sm:px-10"
        style={{ paddingBottom: 24, fontSize: 11, color: "var(--mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        kali · crypto desk · {NETWORK}
      </footer>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        color: "var(--ink)",
        lineHeight: 1.55,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "var(--sakura)",
          color: "white",
          fontSize: 12,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
          border: "2px solid white",
          boxShadow: "1px 1px 0 var(--sticker-shadow)",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "20px 8px", textAlign: "center", color: "var(--mute)", fontSize: 12 }}>
      <Mascot pose="sleep" size={56} />
      <div style={{ marginTop: 4 }}>{msg}</div>
    </div>
  );
}
