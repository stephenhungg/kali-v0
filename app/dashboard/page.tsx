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

import { cookies } from "next/headers";
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
import {
  CuteCard,
  CuteButton,
  CuteStat,
  CutePill,
} from "@/components/kawaii/CutePrimitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORK = (process.env.KALI_X402_NETWORK ?? "solana-devnet") as
  | "solana-devnet"
  | "solana-mainnet";

const DEFAULT_TENANT = "rivertown";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supaConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  // Demo bypass works two ways:
  //   1. ?demo=rivertown directly in the URL (first hit)
  //   2. cookie kali_demo_mode=rivertown (set by middleware on prior demo hit)
  // The cookie is needed for follow-up requests that don't carry the param.
  const demoFromQuery = sp.demo === "rivertown";
  const cookieStore = await cookies();
  const demoFromCookie =
    cookieStore.get("kali_demo_mode")?.value === "rivertown";
  const demoMode = demoFromQuery || demoFromCookie;

  // Resolve tenant + onboarding state.
  let tenantName = "Rivertown Community Foundation";
  let tenantMission: string | undefined;
  let selectedConnectors: string[] = [];

  if (supaConfigured && !demoMode) {
    const { userId, state } = await getOnboardingState();
    if (!userId) redirect("/onboarding");
    if (!state?.onboardedAt) {
      const step = state?.currentStep ?? 1;
      redirect(`/onboarding?step=${step}`);
    }
    tenantName = state.tenant?.name ?? tenantName;
    tenantMission = state.tenant?.mission;
    selectedConnectors = state.selectedConnectors ?? [];
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

  const x402Total = recentReceipts.reduce((s, r) => s + r.amountUsdc, 0);

  return (
    <main className="kawaii-page">
      <DashboardShell
        tenantName={tenantName}
        tenantMission={tenantMission}
        selectedConnectors={selectedConnectors}
        tenantId={tenant?.id ?? DEFAULT_TENANT}
      />

      {/* Onchain row — sticker-style cards */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="kawaii-mono-tag">onchain &amp; web3</h2>
          <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
            {NETWORK}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CuteStat
            label="x402 last 30d"
            value={`$${x402Total.toFixed(2)}`}
            sub={`${recentReceipts.length} receipts settled`}
            tone="mochi"
            accent="letter"
          />
          <CuteStat
            label={coin ? `$${coin.symbol} fees to treasury` : "cause coin"}
            value={fees ? `$${fees.treasury.toFixed(2)}` : "not launched"}
            sub={
              coin
                ? `${holders.length} holders · $${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} mcap`
                : "launch from the crypto desk"
            }
            tone="lemon"
            accent="coin"
          />
          <CuteStat
            label="agent activity"
            value={`${connectors.length}`}
            sub={`${connectors.reduce((s, c) => s + c.tools.length, 0)} tools live · ${connectors.length} connectors`}
            tone="matcha"
            accent="sparkle"
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <CuteButton
            href={`https://${process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai"}/${DEFAULT_TENANT}`}
            tone="sakura"
            size="sm"
          >
            donate page →
          </CuteButton>
          <CuteButton href="/crypto" tone="matcha" size="sm">
            crypto desk →
          </CuteButton>
          <CuteButton href="/chat" tone="ghost" size="sm">
            open chat →
          </CuteButton>
        </div>
      </section>

      {/* Recent x402 receipts */}
      {recentReceipts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="kawaii-mono-tag">recent x402 donations</h2>
            <span className="kawaii-mono-tag" style={{ color: "var(--mute)" }}>
              {recentReceipts.length} on file
            </span>
          </div>
          <CuteCard tone="paper" style={{ padding: 0 }}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recentReceipts.map((r, i) => (
                <li
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : "1px dashed var(--hair)",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "var(--font-mono-geist), ui-monospace, monospace",
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  >
                    {r.payerWallet.slice(0, 4)}…{r.payerWallet.slice(-4)}
                  </code>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    ${r.amountUsdc.toFixed(2)}
                  </span>
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
                  <span style={{ fontSize: 11, color: "var(--mute)" }}>
                    {new Date(r.receivedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CuteCard>
        </section>
      )}

      <footer
        style={{
          borderTop: "1px dashed var(--hair)",
          padding: "16px 0",
          marginTop: 8,
        }}
        className="mx-auto max-w-6xl px-4 sm:px-6"
      >
        <span style={{ fontSize: 11, color: "var(--mute)", letterSpacing: "0.1em" }}>
          kali · {NETWORK} · tenant {tenant?.ein ?? "—"}
        </span>
      </footer>
    </main>
  );
}
