/**
 * Crypto dashboard. Trading-desk aesthetic — dark, monospace, dense.
 * Totally separate from the main /dashboard (which is the nonprofit-OS
 * surface). This is where the operator launches coins, watches inflows,
 * and trades.
 *
 * Sections:
 *   1. Header + tenant chip + network indicator
 *   2. Live stat row: treasury, x402 inflows, $COIN fees, coin count
 *   3. Launch panel — form posts to /api/coin/launch
 *   4. Launched coins table — with one-click trade buttons
 *   5. x402 inflows feed (live)
 *   6. Treasury disbursements feed (from solana connector)
 */

import Link from "next/link";
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
    curve && myCoin
      ? curve.config.initialPriceUsdc + curve.config.slope * curve.progression
      : 0;
  const marketCap =
    curve && myCoin
      ? price * curve.config.totalSupply
      : 0;

  const x402Recent = await listReceipts({ tenantId: tenant.id, windowDays: 30, limit: 10 });
  const x402Total = x402Recent.reduce((s, r) => s + r.amountUsdc, 0);

  return (
    <main className="min-h-screen bg-[#0a0d0c] font-mono text-[#c8e6cb]">
      {/* header */}
      <header className="border-b border-[#1a2421] px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm uppercase tracking-[0.2em] text-[#c8e6cb]/70 hover:text-[#c8e6cb]">
              ← kali
            </Link>
            <span className="text-xl font-semibold tracking-tight">crypto desk</span>
            <span className="rounded-sm bg-[#1a2421] px-2 py-1 text-[10px] uppercase tracking-wider text-[#7fae7e]">
              {NETWORK}
            </span>
            <span className="rounded-sm bg-[#1a2421] px-2 py-1 text-[10px] uppercase tracking-wider">
              {tenant.name}
            </span>
          </div>
          <nav className="flex gap-6 text-xs uppercase tracking-wider">
            <Link href="/crypto" className="text-[#c8e6cb]">overview</Link>
            <Link href="/crypto/launch" className="text-[#c8e6cb]/60 hover:text-[#c8e6cb]">launch</Link>
            <Link href="/crypto/coins" className="text-[#c8e6cb]/60 hover:text-[#c8e6cb]">all coins</Link>
            <Link href="/dashboard" className="text-[#c8e6cb]/60 hover:text-[#c8e6cb]">main →</Link>
          </nav>
        </div>
      </header>

      {/* live stat row */}
      <section className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="x402 inflows · 30d"
            value={`$${x402Total.toFixed(2)}`}
            sub={`${x402Recent.length} receipts`}
            tone="cyan"
          />
          <StatTile
            label={myCoin ? `${myCoin.symbol} treasury fees` : "no coin yet"}
            value={fees ? `$${fees.treasury.toFixed(2)}` : "—"}
            sub={myCoin ? `${holders.length} holders` : "deploy below"}
            tone="green"
          />
          <StatTile
            label={myCoin ? `${myCoin.symbol} market cap` : "—"}
            value={myCoin ? `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            sub={myCoin ? `price $${price.toFixed(8)}` : "—"}
            tone="amber"
          />
          <StatTile
            label="all coins"
            value={`${allCoins.length}`}
            sub={`${allCoins.filter((c) => c.graduationStatus === "graduated").length} graduated`}
            tone="purple"
          />
        </div>

        {myCoin && (
          <div className="mt-4">
            <LiveTreasuryTicker
              mint={myCoin.mint}
              initial={fees ?? { treasury: 0, communityFund: 0, total: 0, tradeCount: 0 }}
              symbol={myCoin.symbol}
            />
          </div>
        )}
      </section>

      {/* launch panel */}
      <section className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div className="rounded-md border border-[#1a2421] bg-[#0e1413] p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
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
          </div>

          <div className="rounded-md border border-[#1a2421] bg-[#0e1413] p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">how it works</div>
            <ol className="mt-4 space-y-3 text-xs leading-relaxed text-[#c8e6cb]/80">
              <li>
                <span className="text-[#7fae7e]">1.</span> Pick a symbol + name. This becomes
                the SPL mint metadata embedded with your EIN + IRS status.
              </li>
              <li>
                <span className="text-[#7fae7e]">2.</span> Treasury, community-fund, and
                platform-reserve wallets auto-derive from your tenant id (deterministic — same
                pubkeys every run).
              </li>
              <li>
                <span className="text-[#7fae7e]">3.</span> Meteora bonding curve pool is created
                with 1% fee → 100% to treasury (20% routes to a holder-governed community fund).
              </li>
              <li>
                <span className="text-[#7fae7e]">4.</span> Live deploy when{" "}
                <code className="rounded bg-black/40 px-1">KALI_SOLANA_DEVNET_SECRET_KEY</code>{" "}
                is set + funder has SOL. Otherwise simulated with realistic-looking pubkeys.
              </li>
              <li>
                <span className="text-[#7fae7e]">5.</span> Public trading page goes live at{" "}
                <code className="rounded bg-black/40 px-1">coin.kalilabs.ai/{tenant.slug}</code>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* recent inflows + trades */}
      <section className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="x402 inflows · live">
            {x402Recent.length === 0 ? (
              <Empty msg="no donations yet — try `bun run x402:donate --amount 25`" />
            ) : (
              <ul className="divide-y divide-[#1a2421]">
                {x402Recent.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-3 py-2 text-xs items-center"
                  >
                    <AttrPill a={r.attribution} />
                    <span>{shortAddr(r.payerWallet)}</span>
                    <span className="text-right text-[#7fae7e]">${r.amountUsdc.toFixed(2)}</span>
                    <a
                      href={explorer(r.txSignature, "tx")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#5fa088] underline-offset-2 hover:underline"
                    >
                      ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={myCoin ? `${myCoin.symbol} trades · live` : "trades — launch a coin first"}>
            {!myCoin || recentTrades.length === 0 ? (
              <Empty msg={myCoin ? "no trades yet" : "deploy your coin to start"} />
            ) : (
              <ul className="divide-y divide-[#1a2421]">
                {recentTrades.map((t) => (
                  <li key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 py-2 text-xs items-center">
                    <span
                      className={`text-[10px] uppercase tracking-wider ${
                        t.side === "buy" ? "text-[#7fae7e]" : "text-[#e88a8a]"
                      }`}
                    >
                      {t.side}
                    </span>
                    <span>{shortAddr(t.wallet)}</span>
                    <span className="text-right">${t.usdcAmount.toFixed(2)}</span>
                    <a
                      href={explorer(t.txSignature, "tx")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#5fa088] underline-offset-2 hover:underline"
                    >
                      ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* footer */}
      <footer className="mt-12 border-t border-[#1a2421] px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between text-[10px] uppercase tracking-wider text-[#c8e6cb]/40">
          <span>kali · crypto desk</span>
          <span>{NETWORK} · ein {tenant.ein}</span>
        </div>
      </footer>
    </main>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "cyan" | "green" | "amber" | "purple";
}) {
  const colors = {
    cyan: "text-[#7fbed1]",
    green: "text-[#7fae7e]",
    amber: "text-[#d4b27a]",
    purple: "text-[#b08cd1]",
  };
  return (
    <div className="rounded-md border border-[#1a2421] bg-[#0e1413] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#c8e6cb]/50">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="mt-1 text-[10px] text-[#c8e6cb]/40">{sub}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#1a2421] bg-[#0e1413] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-[10px] text-[#c8e6cb]/40">{msg}</div>;
}

function AttrPill({ a }: { a: "human" | "autonomous" | "unknown" }) {
  const map = {
    human: "bg-[#3a1d28] text-[#e88a8a]",
    autonomous: "bg-[#1d3a2a] text-[#7fae7e]",
    unknown: "bg-[#1a2421] text-[#c8e6cb]/60",
  };
  return (
    <span className={`rounded-sm px-1.5 py-[1px] text-[9px] uppercase tracking-wider ${map[a]}`}>
      {a}
    </span>
  );
}
