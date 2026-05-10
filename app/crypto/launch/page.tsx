import Link from "next/link";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";
import { initAllAndTrack } from "@/lib/connectors/sync-state";
import { listTenants } from "@/lib/tenants";
import { isMemoryMode, memoryStore } from "@/lib/db/memory";
import { LaunchCoinFormStandalone } from "./LaunchCoinFormStandalone";
import { CuteCard, CutePill } from "@/components/kawaii/CutePrimitives";
import { StickerLogo } from "@/components/kawaii/StickerLogo";
import { Mascot } from "@/components/kawaii/Mascot";

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
    <main className="kawaii-page">
      <header style={{ borderBottom: "2px dashed var(--hair)", padding: "20px 0" }}>
        <div
          className="mx-auto max-w-[1500px] px-6 sm:px-10"
          style={{ display: "flex", alignItems: "center", gap: 14 }}
        >
          <Link href="/crypto">
            <StickerLogo size={56} />
          </Link>
          <span className="kawaii-display" style={{ fontSize: 22, color: "var(--ink)" }}>
            · launch
          </span>
          <CutePill tone="lemon">{NETWORK}</CutePill>
        </div>
      </header>

      <section className="mx-auto max-w-[900px] px-6 py-10 sm:px-10">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h1
              className="kawaii-display"
              style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.05, color: "var(--ink)", margin: 0 }}
            >
              deploy a{" "}
              <span style={{ color: "var(--sakura)", fontStyle: "italic" }}>new</span>{" "}
              cause coin
            </h1>
            <p style={{ marginTop: 10, fontSize: 14, color: "var(--mute)", maxWidth: 600, lineHeight: 1.55 }}>
              one coin per tenant. SPL Token-2022 mint + bonding curve pool deployed atomically.
              treasury wallet auto-derived from tenant id (deterministic across runs). 1% trading
              fee → 100% to treasury. 20% of fees route to a holder-governed community fund.
            </p>
          </div>
          <div className="hidden md:block">
            <Mascot pose="coin" size={120} tiltDeg={-4} />
          </div>
        </div>

        <CuteCard tone="cloud" style={{ marginTop: 16 }}>
          <div className="kawaii-mono-tag" style={{ marginBottom: 8 }}>
            tenant
          </div>
          <select
            disabled
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              borderRadius: 12,
              border: "2px solid white",
              background: "white",
              color: "var(--ink)",
              opacity: 0.7,
              cursor: "not-allowed",
              fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
              fontWeight: 600,
              boxShadow: "1px 2px 0 var(--sticker-shadow)",
            }}
          >
            {tenants.map((t) => (
              <option key={t.id}>
                {t.name} {tenantsWithCoins.has(t.id) ? "· already has coin" : "· available"}
              </option>
            ))}
          </select>
          <p style={{ marginTop: 8, fontSize: 11, color: "var(--mute)" }}>
            v1 is single-tenant (Rivertown). Multi-tenant onboarding lands in M7.
          </p>
        </CuteCard>

        <CuteCard tone="paper" accent="sparkle" style={{ marginTop: 18 }}>
          <LaunchCoinFormStandalone defaultTenantSlug={tenants[0]?.slug ?? "rivertown"} />
        </CuteCard>

        <CuteCard tone="lemon" style={{ marginTop: 18 }}>
          <div className="kawaii-mono-tag" style={{ marginBottom: 8 }}>
            also available · cli
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: "var(--font-mono-geist), monospace",
              fontSize: 12,
              color: "var(--ink)",
              background: "white",
              border: "2px solid white",
              borderRadius: 10,
              padding: "12px 14px",
              boxShadow: "1px 2px 0 var(--sticker-shadow)",
              whiteSpace: "pre-wrap",
            }}
          >
{`# from terminal:
bun run causecoin:launch -- --tenant rivertown --symbol RVRT --name Rivertown

# pre-load demo seed (312 holders, 600 trades, 14 entity links):
bun run seed:causecoin`}
          </pre>
        </CuteCard>
      </section>
    </main>
  );
}
