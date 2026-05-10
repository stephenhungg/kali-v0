/**
 * Cause-coin directory. Public list of every cause coin live on Kali. Sortable
 * by total fees raised, holder count, market cap. Powers agent discovery
 * ("which Kali nonprofits have community tokens I can buy?").
 */

import Link from "next/link";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { listTenants } from "@/lib/tenants";
import { cumulativeFees, listHolders, curveStateFor } from "@/lib/causecoin/trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CoinDirectory() {
  const tenants = await listTenants();
  const tenantBySlug = new Map(tenants.map((t) => [t.id, t.slug] as const));
  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name] as const));
  const coins = isMemoryMode() ? memoryStore.get("causeCoins") : [];

  const enriched = coins.map((c) => {
    const fees = cumulativeFees(c.id);
    const holders = listHolders(c.id);
    const { config, progression } = curveStateFor(c);
    const price = config.initialPriceUsdc + config.slope * progression;
    return {
      coin: c,
      fees,
      holderCount: holders.length,
      marketCapUsd: price * config.totalSupply,
      tenantName: tenantNameById.get(c.tenantId) ?? c.tenantId,
      tenantSlug: tenantBySlug.get(c.tenantId) ?? c.tenantId,
    };
  });

  enriched.sort((a, b) => b.fees.treasury - a.fees.treasury);

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-24 sm:px-12">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
          (cause coin directory)
        </div>
        <h1 className="r-display mt-6 text-[10vw] font-medium leading-[0.95] tracking-tight sm:text-[6.5vw] md:text-[80px]">
          every nonprofit token{" "}
          <span className="r-italic font-light text-[var(--strawberry-deep)]">on Kali</span>
        </h1>
        <p className="mt-6 max-w-[640px] text-sm opacity-80">
          Each row is a 501(c)(3) running an SPL token on Solana via Meteora's Dynamic Bonding
          Curve. Every trade routes 1% of fees to that nonprofit's treasury. Sort by total raised
          to back the cause with the most traction, or scroll for those still discovering theirs.
        </p>

        {enriched.length === 0 ? (
          <div className="chat-card mt-12 p-8 text-sm opacity-70">
            No coins live yet. Run{" "}
            <code className="rounded bg-[var(--mint-pale)] px-1.5">
              bun scripts/launch-cause-coin.ts --tenant rivertown --symbol RVRT
            </code>{" "}
            to deploy the demo coin.
          </div>
        ) : (
          <ul className="mt-12 divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
            {enriched.map((row) => (
              <li
                key={row.coin.id}
                className="grid grid-cols-1 gap-2 py-6 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <div>
                  <Link
                    href={`/${row.tenantSlug}`}
                    className="r-display text-2xl hover:text-[var(--strawberry-deep)]"
                  >
                    ${row.coin.symbol}{" "}
                    <span className="text-base opacity-70">· {row.tenantName}</span>
                  </Link>
                  <div className="mt-1 text-xs opacity-60">{row.coin.metadata.cause ?? ""}</div>
                </div>
                <Stat label="fees raised" value={`$${row.fees.treasury.toFixed(0)}`} />
                <Stat
                  label="market cap"
                  value={`$${row.marketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                />
                <Stat label="holders" value={`${row.holderCount}`} />
                <Link
                  href={`/${row.tenantSlug}`}
                  className="rounded bg-[var(--matcha-deep)] px-4 py-2 text-center text-xs text-[var(--cream)]"
                >
                  trade →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="font-mono text-base">{value}</div>
    </div>
  );
}
