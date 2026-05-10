/**
 * All deployed coins. Sortable table with quick-trade links + raw mint
 * addresses for copying.
 */

import Link from "next/link";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack } from "@/lib/connectors/sync-state";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { listTenants } from "@/lib/tenants";
import {
  cumulativeFees,
  curveStateFor,
  listHolders,
  tradesIn,
} from "@/lib/causecoin/trading";
import {
  CuteCard,
  CuteButton,
  CutePill,
} from "@/components/kawaii/CutePrimitives";
import { Mascot } from "@/components/kawaii/Mascot";
import { StickerLogo } from "@/components/kawaii/StickerLogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

function explorer(addr: string): string {
  const base = process.env.SOLANA_EXPLORER_BASE ?? "https://explorer.solana.com";
  const cluster = NETWORK === "solana-mainnet" ? "" : "?cluster=devnet";
  return `${base}/address/${addr}${cluster}`;
}

function shortAddr(s: string): string {
  return s.length <= 12 ? s : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export default async function AllCoinsPage() {
  await initAllAndTrack(
    listConnectors().map((c) => ({ id: c.id, label: c.label, init: c.init })),
  );
  const tenants = await listTenants();
  const tenantById = new Map(tenants.map((t) => [t.id, t] as const));
  const coins = isMemoryMode() ? memoryStore.get("causeCoins") : [];

  const enriched = coins.map((c) => {
    const fees = cumulativeFees(c.id);
    const holders = listHolders(c.id);
    const { config, progression } = curveStateFor(c);
    const price = config.initialPriceUsdc + config.slope * progression;
    const mcap = price * config.totalSupply;
    const day = tradesIn(c.id, Date.now() - 86_400_000);
    return {
      coin: c,
      tenant: tenantById.get(c.tenantId),
      fees,
      holderCount: holders.length,
      mcap,
      vol24h: day.reduce((s, t) => s + t.usdcAmount, 0),
      trades24h: day.length,
    };
  });

  enriched.sort((a, b) => b.fees.treasury - a.fees.treasury);

  return (
    <main className="kawaii-page">
      <header style={{ borderBottom: "2px dashed var(--hair)", padding: "20px 0" }}>
        <div className="mx-auto max-w-[1500px] px-6 sm:px-10" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/crypto"><StickerLogo size={56} /></Link>
          <span className="kawaii-display" style={{ fontSize: 22, color: "var(--ink)" }}>· all coins</span>
          <CutePill tone="lemon">{NETWORK}</CutePill>
          <div style={{ marginLeft: "auto" }}>
            <CuteButton href="/crypto/launch" tone="sakura" size="sm">+ launch new</CuteButton>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-10 sm:px-10">
        {enriched.length === 0 ? (
          <CuteCard tone="cloud" style={{ padding: "32px 24px", textAlign: "center" }}>
            <Mascot pose="sleep" size={96} />
            <div className="kawaii-display" style={{ fontSize: 22, color: "var(--ink)", marginTop: 12 }}>
              no coins deployed yet
            </div>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--mute)" }}>
              run{" "}
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
                bun run seed:causecoin
              </code>{" "}
              to load the demo $RVRT.
            </p>
            <div style={{ marginTop: 16 }}>
              <CuteButton href="/crypto/launch" tone="sakura">
                launch your first coin →
              </CuteButton>
            </div>
          </CuteCard>
        ) : (
          <CuteCard tone="paper" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--cloud)" }}>
                  <Th>symbol</Th>
                  <Th>tenant</Th>
                  <Th align="right">market cap</Th>
                  <Th align="right">vol 24h</Th>
                  <Th align="right">trades 24h</Th>
                  <Th align="right">fees raised</Th>
                  <Th align="right">holders</Th>
                  <Th align="right">status</Th>
                  <Th>mint</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {enriched.map((row, i) => (
                  <tr
                    key={row.coin.id}
                    style={{
                      borderTop: i === 0 ? "none" : "1px dashed var(--hair)",
                      background: i % 2 === 0 ? "transparent" : "rgba(252, 233, 225, 0.4)",
                    }}
                  >
                    <Td>
                      <span
                        className="kawaii-display"
                        style={{ fontSize: 18, color: "var(--matcha-deep-warm)" }}
                      >
                        ${row.coin.symbol}
                      </span>
                    </Td>
                    <Td className="ink">{row.tenant?.name ?? row.coin.tenantId}</Td>
                    <Td align="right">
                      ${row.mcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td align="right">
                      ${row.vol24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td align="right">{row.trades24h}</Td>
                    <Td align="right" style={{ color: "var(--matcha-deep-warm)", fontWeight: 700 }}>
                      ${row.fees.treasury.toFixed(2)}
                    </Td>
                    <Td align="right">{row.holderCount}</Td>
                    <Td align="right">
                      <CutePill
                        tone={
                          row.coin.graduationStatus === "graduated"
                            ? "matcha"
                            : row.coin.graduationStatus === "graduating"
                              ? "lemon"
                              : "sakura"
                        }
                      >
                        {row.coin.graduationStatus}
                      </CutePill>
                    </Td>
                    <Td>
                      <a
                        href={explorer(row.coin.mint)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--sakura)",
                          textDecoration: "none",
                          fontFamily: "var(--font-mono-geist), monospace",
                        }}
                      >
                        {shortAddr(row.coin.mint)} ↗
                      </a>
                    </Td>
                    <Td>
                      {row.tenant && (
                        <CuteButton href={`/coin/${row.tenant.slug}`} tone="sakura" size="sm">
                          trade →
                        </CuteButton>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CuteCard>
        )}
      </section>
    </main>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: align,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--mute)",
        fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={className}
      style={{
        padding: "12px 16px",
        textAlign: align,
        fontVariantNumeric: "tabular-nums",
        color: "var(--ink)",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
