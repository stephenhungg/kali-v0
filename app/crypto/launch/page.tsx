/**
 * Dedicated coin launcher. Bigger form + full diagnostics. Useful when
 * you want to launch one for a different tenant or override defaults.
 */

import Link from "next/link";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack } from "@/lib/connectors/sync-state";
import { listTenants } from "@/lib/tenants";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { LaunchCoinFormStandalone } from "./LaunchCoinFormStandalone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

export default async function LaunchPage() {
  await initAllAndTrack(
    listConnectors().map((c) => ({ id: c.id, label: c.label, init: c.init })),
  );
  const tenants = await listTenants();
  const coins = isMemoryMode() ? memoryStore.get("causeCoins") : [];
  const tenantsWithCoins = new Set(coins.map((c) => c.tenantId));

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
            <span className="text-xl font-semibold tracking-tight">launch</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[#7fae7e]">{NETWORK}</span>
        </div>
      </header>

      <section className="mx-auto max-w-[900px] px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">deploy a new cause coin</h1>
        <p className="mt-3 max-w-[640px] text-sm text-[#c8e6cb]/70">
          One coin per tenant. SPL token + Meteora bonding curve pool deployed in a single
          atomic transaction. Treasury wallet auto-derived from tenant id (deterministic across
          runs). 1% trading fee → 100% to treasury. 20% of fees route to a holder-governed
          community fund.
        </p>

        <div className="mt-8 rounded-md border border-[#1a2421] bg-[#0e1413] p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">tenant</div>
          <select
            disabled
            className="mt-2 w-full cursor-not-allowed rounded border border-[#1a2421] bg-[#050807] px-3 py-2 text-sm text-[#c8e6cb]/60"
          >
            {tenants.map((t) => (
              <option key={t.id}>
                {t.name} {tenantsWithCoins.has(t.id) ? "· already has coin" : "· available"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] text-[#c8e6cb]/40">
            v1 is single-tenant (Rivertown). Multi-tenant onboarding lands in M7.
          </p>
        </div>

        <div className="mt-6 rounded-md border border-[#1a2421] bg-[#0e1413] p-6">
          <LaunchCoinFormStandalone defaultTenantSlug={tenants[0]?.slug ?? "rivertown"} />
        </div>

        <div className="mt-6 rounded-md border border-[#1a2421] bg-[#0e1413] p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7fae7e]">
            also available · cli
          </div>
          <pre className="mt-3 overflow-x-auto text-xs text-[#c8e6cb]/80">
{`# from terminal:
bun run causecoin:launch -- --tenant rivertown --symbol RVRT --name Rivertown
bun run causecoin:launch -- --tenant rivertown --symbol RVRT --cause "youth mentorship"

# pre-load demo seed (312 holders, 600 trades, 14 entity links):
bun run seed:causecoin`}
          </pre>
        </div>
      </section>
    </main>
  );
}
