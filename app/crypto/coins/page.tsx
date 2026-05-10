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
    <main className="min-h-screen bg-[#0a0d0c] font-mono text-[#c8e6cb]">
      <header className="border-b border-[#1a2421] px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/crypto"
              className="text-sm uppercase tracking-[0.2em] text-[#c8e6cb]/70 hover:text-[#c8e6cb]"
            >
              ← crypto desk
            </Link>
            <span className="text-xl font-semibold tracking-tight">all coins</span>
          </div>
          <Link
            href="/crypto/launch"
            className="rounded bg-[#1d3a2a] px-3 py-1.5 text-xs uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638]"
          >
            + launch new
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-6 py-8">
        {enriched.length === 0 ? (
          <div className="rounded-md border border-[#1a2421] bg-[#0e1413] p-12 text-center">
            <div className="text-2xl text-[#c8e6cb]/40">no coins deployed yet</div>
            <p className="mt-3 text-xs text-[#c8e6cb]/60">
              run <code className="rounded bg-black/40 px-2 py-0.5">bun run seed:causecoin</code>{" "}
              to load the demo $RVRT, or{" "}
              <Link href="/crypto/launch" className="text-[#7fae7e] underline-offset-2 hover:underline">
                launch your first coin →
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#1a2421] bg-[#0e1413]">
            <table className="w-full text-xs">
              <thead className="border-b border-[#1a2421] text-[10px] uppercase tracking-[0.2em] text-[#c8e6cb]/40">
                <tr>
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
                {enriched.map((row) => (
                  <tr
                    key={row.coin.id}
                    className="border-b border-[#1a2421]/50 hover:bg-[#1a2421]/30"
                  >
                    <Td>
                      <span className="text-base font-semibold text-[#7fae7e]">
                        ${row.coin.symbol}
                      </span>
                    </Td>
                    <Td className="text-[#c8e6cb]/80">
                      {row.tenant?.name ?? row.coin.tenantId}
                    </Td>
                    <Td align="right">
                      ${row.mcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td align="right">
                      ${row.vol24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td align="right">{row.trades24h}</Td>
                    <Td align="right" className="text-[#7fae7e]">
                      ${row.fees.treasury.toFixed(2)}
                    </Td>
                    <Td align="right">{row.holderCount}</Td>
                    <Td align="right">
                      <StatusBadge status={row.coin.graduationStatus} />
                    </Td>
                    <Td>
                      <a
                        href={explorer(row.coin.mint)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#5fa088] underline-offset-2 hover:underline"
                      >
                        {shortAddr(row.coin.mint)} ↗
                      </a>
                    </Td>
                    <Td>
                      {row.tenant && (
                        <Link
                          href={`/coin/${row.tenant.slug}`}
                          className="rounded bg-[#1d3a2a] px-3 py-1 text-[10px] uppercase tracking-wider text-[#7fae7e] hover:bg-[#244638]"
                        >
                          trade →
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-3 text-${align} font-normal`}>{children}</th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-${align} tabular-nums ${className}`}>{children}</td>
  );
}

function StatusBadge({ status }: { status: "bonding" | "graduating" | "graduated" }) {
  const map = {
    bonding: "bg-[#1d3a2a] text-[#7fae7e]",
    graduating: "bg-[#3a3a1d] text-[#d4b27a]",
    graduated: "bg-[#1d2a3a] text-[#7fbed1]",
  };
  return (
    <span className={`rounded-sm px-2 py-[2px] text-[9px] uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}
