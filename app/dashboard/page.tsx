/**
 * Tenant dashboard — landing page after onboarding.
 *
 * Auth gate: requires Supabase session AND completed onboarding. Routes
 * unauthenticated visitors to /onboarding; routes mid-flow visitors to
 * their last step. If Supabase isn't configured at all, falls back to the
 * Rivertown demo tenant so unconfigured local dev still renders.
 *
 * Layout:
 *   1. Personalized hero — greeting + tenant name + mission
 *   2. Stat cards row (records / donations / cash / grants)
 *   3. Recent activity (forged feed) + Sources grid
 *   4. QuickAsk composer with personalized suggestions
 *   5. Onchain panel — x402 receipts + cause coin (if launched)
 *   6. Full connector grid (every registered connector)
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack } from "@/lib/connectors/sync-state";
import { listReceipts } from "@/lib/x402/receipt";
import {
  cumulativeFees,
  curveStateFor,
  listHolders,
  loadCoinByTenant,
} from "@/lib/causecoin/trading";
import { resolveTenant } from "@/lib/tenants";
import { getOnboardingState } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

const DEFAULT_TENANT = "rivertown";

export default async function DashboardPage() {
  const supaConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Resolve tenant + onboarding state.
  let tenantName = "Rivertown Community Foundation";
  let tenantMission: string | undefined;
  let selectedConnectors: string[] = [];
  let seedId = "rivertown-demo";

  if (supaConfigured) {
    const { userId, state } = await getOnboardingState();
    if (!userId) redirect("/onboarding");
    if (!state?.onboardedAt) {
      const step = state?.currentStep ?? 1;
      redirect(`/onboarding?step=${step}`);
    }
    tenantName = state.tenant?.name ?? tenantName;
    tenantMission = state.tenant?.mission;
    selectedConnectors = state.selectedConnectors ?? [];
    seedId = userId;
  }

  // Force connector init + load downstream data.
  await initAllAndTrack(
    listConnectors().map((c) => ({ id: c.id, label: c.label, init: c.init })),
  );

  const tenant = await resolveTenant(DEFAULT_TENANT);
  const connectors = listConnectors();
  const recentReceipts = tenant
    ? await listReceipts({ tenantId: tenant.id, windowDays: 30, limit: 8 })
    : [];
  const coin = tenant ? loadCoinByTenant(tenant.id) : null;
  const fees = coin ? cumulativeFees(coin.id) : null;
  const holders = coin ? listHolders(coin.id) : [];
  const curve = coin ? curveStateFor(coin) : null;
  const marketCap =
    curve && coin
      ? (curve.config.initialPriceUsdc + curve.config.slope * curve.progression) *
        curve.config.totalSupply
      : 0;

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--matcha-deep)]">
      <DashboardShell
        tenantName={tenantName}
        tenantMission={tenantMission}
        selectedConnectors={selectedConnectors}
        seedId={seedId}
      />

      {/* Onchain hero — preserved from existing dashboard */}
      <section className="mx-auto max-w-6xl border-t border-[var(--mint-line)] px-4 py-10 sm:px-6">
        <h2 className="r-display mb-1 text-2xl text-[var(--matcha-deep)]">onchain & web3</h2>
        <p className="mb-6 text-xs text-[var(--gray-ink)]">
          x402 donation receipts + cause coin economics
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChromeCard
            label="x402 last 30d"
            value={`$${recentReceipts.reduce((s, r) => s + r.amountUsdc, 0).toFixed(2)}`}
            sub={`${recentReceipts.length} receipts · network ${NETWORK}`}
            cta={{
              href: `https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${DEFAULT_TENANT}`,
              text: "view donate page →",
            }}
          />
          <ChromeCard
            label={coin ? `$${coin.symbol} fees to treasury` : "cause coin"}
            value={fees ? `$${fees.treasury.toFixed(2)}` : "not launched"}
            sub={
              coin
                ? `${holders.length} holders · ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} mcap`
                : "launch to enable"
            }
            cta={
              coin
                ? {
                    href: `https://${process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai"}/${DEFAULT_TENANT}`,
                    text: "view trading →",
                  }
                : undefined
            }
          />
          <ChromeCard
            label="agent activity"
            value={`${connectors.length} connectors`}
            sub={`${connectors.reduce((s, c) => s + c.tools.length, 0)} tools live`}
            cta={{ href: "/chat", text: "open chat →" }}
          />
        </div>
      </section>

      {/* Recent x402 receipts */}
      {recentReceipts.length > 0 && (
        <section className="mx-auto max-w-6xl border-t border-[var(--mint-line)] px-4 py-10 sm:px-6">
          <h2 className="r-display mb-1 text-2xl">recent x402 donations</h2>
          <p className="mb-6 text-xs text-[var(--gray-ink)]">
            machine-payable HTTP donation receipts
          </p>
          <ul className="divide-y divide-[var(--mint-line-soft)] border-y border-[var(--mint-line-soft)]">
            {recentReceipts.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3">
                <code className="font-mono text-xs">
                  {r.payerWallet.slice(0, 4)}…{r.payerWallet.slice(-4)}
                </code>
                <span className="font-mono text-sm">${r.amountUsdc.toFixed(2)}</span>
                <span
                  className={`rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide ${
                    r.attribution === "human"
                      ? "bg-[var(--strawberry-soft)] text-[var(--strawberry-deep)]"
                      : r.attribution === "autonomous"
                      ? "bg-[var(--matcha-mid)] text-[var(--cream)]"
                      : "bg-[var(--mint-pale)]"
                  }`}
                >
                  {r.attribution}
                </span>
                <span className="text-xs text-[var(--gray-ink)]">
                  {new Date(r.receivedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mx-auto max-w-6xl border-t border-[var(--mint-line)] px-4 py-6 sm:px-6">
        <span className="font-mono text-xs text-[var(--gray-ink)]">
          kali · {NETWORK} · tenant {tenant?.ein ?? "—"}
        </span>
        <Link href="/chat" className="ml-4 font-mono text-xs text-[var(--matcha-mid)] underline-offset-2 hover:underline">
          open chat →
        </Link>
      </footer>
    </main>
  );
}

function ChromeCard({
  label,
  value,
  sub,
  cta,
}: {
  label: string;
  value: string;
  sub: string;
  cta?: { href: string; text: string };
}) {
  return (
    <div className="chat-card flex flex-col p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gray-ink)]">
        {label}
      </div>
      <div className="r-display mt-2 text-3xl text-[var(--matcha-deep)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--gray-ink)]">{sub}</div>
      {cta && (
        <Link href={cta.href} className="mt-4 text-xs text-[var(--matcha-mid)] underline-offset-2 hover:underline">
          {cta.text}
        </Link>
      )}
    </div>
  );
}
