import Link from "next/link";
import "@/lib/agent/registrations";
import { listConnectors } from "@/lib/connectors/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Ground the landing page in real numbers from the connector registry.
  const connectors = listConnectors();
  const totalTools = connectors.reduce((s, c) => s + c.tools.length, 0);

  return (
    <main className="bg-[var(--matcha-deep)] text-[var(--cream)] antialiased">
      <Header />
      <Hero />
      <Capabilities />
      <DreamToReality />
      <Stats connectorCount={connectors.length} toolCount={totalTools} />
      <Status />
      <Footer />
    </main>
  );
}

/* ─── header ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[1400px] items-center justify-between px-8 py-6 sm:px-12">
      <div className="flex items-center gap-2.5">
        <KaliMark className="h-5 w-5" />
        <span className="r-display text-2xl font-medium tracking-tight">kali</span>
      </div>
      <nav className="hidden items-center gap-10 text-sm md:flex">
        <a href="#capabilities" className="transition-colors hover:text-[var(--strawberry-soft)]">
          Capabilities
        </a>
        <a href="#numbers" className="transition-colors hover:text-[var(--strawberry-soft)]">
          The numbers
        </a>
        <a href="#status" className="transition-colors hover:text-[var(--strawberry-soft)]">
          Status
        </a>
      </nav>
      <Link
        href="/dashboard?demo=rivertown"
        className="inline-flex items-center gap-2 bg-[var(--cream)] px-5 py-2.5 text-sm text-[var(--matcha-deep)] transition-transform hover:scale-[1.02]"
      >
        Open the demo
      </Link>
    </header>
  );
}

function KaliMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <circle cx="2.5" cy="10" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="17.5" cy="10" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="2.5" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="17.5" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/* ─── hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[var(--cream)] text-[var(--matcha-deep)]">
      {/* photo strip — layered overlapping panels */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute right-[10%] top-[18%] h-[280px] w-[400px] -rotate-3 bg-[var(--strawberry-soft)] sm:h-[340px] sm:w-[480px]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute left-[8%] top-[40%] h-[220px] w-[300px] rotate-[2deg] bg-[var(--matcha-mid)] sm:h-[260px] sm:w-[360px]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=900&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute bottom-[12%] right-[18%] h-[200px] w-[280px] -rotate-[6deg] bg-[var(--strawberry-deep)] sm:h-[240px] sm:w-[340px]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1542401886-65d6c61db217?w=900&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col px-8 pt-32 sm:px-12">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
          (kali · for nonprofits · hackdavis 2026)
        </div>

        <h1 className="r-display mt-8 text-[18vw] font-medium leading-[0.9] tracking-tight text-[var(--matcha-deep)] sm:text-[14vw] md:text-[200px]">
          <span className="block">Ask once.</span>
          <span className="block">
            <span className="r-italic font-light text-[var(--strawberry-deep)]">Across</span>
          </span>
          <span className="block">every tool.</span>
        </h1>

        <div className="mt-auto flex flex-col gap-6 pb-12 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/70">
            <span className="inline-block h-3 w-3 animate-bounce rounded-full bg-[var(--strawberry-deep)]" />
            Scroll down
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--matcha-deep)]/70 sm:text-base">
            One agentic chat across 11 nonprofit SaaS tools — Bloomerang, Salesforce NPSP, M365,
            QuickBooks, Instrumentl, SharePoint, Zoom, Power Automate, Power BI, KnowBe4, Solana.
            Every answer cited back to its source. Plus a real x402 + Solana payments rail.
          </p>
          <Link
            href="/dashboard?demo=rivertown"
            className="inline-flex items-center gap-2 self-start border border-[var(--matcha-deep)]/20 bg-transparent px-5 py-2.5 text-sm text-[var(--matcha-deep)] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)] md:self-end"
          >
            See the demo →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── capabilities ─────────────────────────────────────────────────────── */

const CAPABILITIES = [
  {
    title: "Cross-tool reasoning",
    blurb:
      "Ask in plain English. The agent fans out to every connected SaaS tool in parallel, joins the data through entity resolution, and answers with citations to source records.",
    tag: "Donors · Grants · Finance · Comms",
    href: "/chat?demo=rivertown",
  },
  {
    title: "x402 agent donations",
    blurb:
      "Public HTTP 402 endpoint per tenant. Any AI agent can pay USDC over the wire. Tax-deductible receipts auto-issued for human-attributed gifts. Real onchain settlement on Solana.",
    tag: "Solana devnet · USDC · Privy delegation",
    href: "/pay/rivertown",
  },
  {
    title: "Cause Coins",
    blurb:
      "Per-tenant SPL Token-2022 mint with onchain metadata, no freeze authority, 1B initial supply to the treasury. The wow query: cross-reference holders against your existing donor base.",
    tag: "Token-2022 · Bonding curve · Holder governance",
    href: "/crypto",
  },
  {
    title: "Audit log + receipts",
    blurb:
      "Every tool call and every onchain receipt is recorded immutably. CSV-exportable. Tax-receipt PDFs (HMAC-signed URLs) for any human-attributed donation, IRS-compliant attestation language.",
    tag: "Compliance · Provenance · pdf-lib",
    href: "/dashboard",
  },
] as const;

function Capabilities() {
  return (
    <section id="capabilities" className="bg-[var(--cream)] text-[var(--matcha-deep)]">
      <div className="mx-auto max-w-[1400px] px-8 py-32 sm:px-12 sm:py-40">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
              (capabilities)
            </div>
            <h2 className="r-display mt-4 text-[12vw] font-medium leading-[0.9] tracking-tight text-[var(--matcha-deep)] sm:text-[8vw] md:text-[120px]">
              What it{" "}
              <span className="r-italic font-light text-[var(--strawberry-deep)]">does</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--matcha-deep)]/70 sm:text-base">
            One agent. Eleven SaaS connectors. A real onchain payments rail. Built for nonprofits
            that drown in tool sprawl.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {CAPABILITIES.map((c, i) => (
            <article
              key={c.title}
              className={`group relative flex flex-col gap-6 border border-[var(--matcha-deep)]/15 bg-[var(--surface)] p-8 transition-colors hover:bg-[var(--mint-pale)] ${
                i === 0 ? "md:col-span-2" : ""
              }`}
            >
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/50">
                {c.tag}
              </div>
              <h3 className="r-display text-3xl font-medium tracking-tight sm:text-4xl">
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--matcha-deep)]/70 sm:text-base">
                {c.blurb}
              </p>
              <Link
                href={c.href}
                className="mt-auto inline-flex items-center gap-2 self-start border border-[var(--matcha-deep)]/20 bg-transparent px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]"
              >
                Open →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── from dream to reality ────────────────────────────────────────────── */

function DreamToReality() {
  return (
    <section className="overflow-hidden bg-[var(--matcha-deep)] py-2">
      <div className="r-display flex animate-r-marquee whitespace-nowrap text-[14vw] font-medium tracking-tight text-[var(--cream)] sm:text-[12vw] md:text-[150px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="mx-8 inline-flex items-center gap-8">
            ask{" "}
            <span className="r-italic font-light text-[var(--strawberry-soft)]">across</span>{" "}
            every tool
            <span className="text-[var(--strawberry-deep)]">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── stats (real numbers from the connector registry) ─────────────────── */

function Stats({
  connectorCount,
  toolCount,
}: {
  connectorCount: number;
  toolCount: number;
}) {
  // Every number on this row is computed at request time from real code:
  //   - connectorCount: listConnectors().length
  //   - toolCount     : sum of c.tools.length across connectors
  //   - 1             : the one tenant ("Rivertown") wired into lib/tenants.ts
  // Add a stat → ground it in something computable. No estimates.
  const STATS = [
    { value: String(connectorCount), label: "connectors wired" },
    { value: String(toolCount), label: "agent tools live" },
    { value: "1", label: "demo tenant ready" },
  ] as const;

  return (
    <section
      id="numbers"
      className="bg-[var(--matcha-deep)] py-32 text-[var(--cream)] sm:py-40"
    >
      <div className="mx-auto max-w-[1400px] px-8 sm:px-12">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <div className="flex items-baseline gap-6 sm:gap-10">
              {STATS.map((s) => (
                <div key={s.label} className="flex-1">
                  <div className="r-display text-[18vw] font-medium leading-none tracking-tight sm:text-[8vw] md:text-[92px]">
                    {s.value}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.15em] text-[var(--cream)]/60">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-7 md:pl-16">
            <p className="text-balance text-lg leading-relaxed text-[var(--cream)]/80 sm:text-xl">
              Each number above is computed at page-render time from{" "}
              <code className="rounded bg-[var(--cream)]/10 px-1.5 text-[var(--strawberry-soft)]">
                listConnectors()
              </code>{" "}
              over the live registry — they're not hardcoded marketing copy. Every metric in this
              app traces to real code or seed data; the dashboard uses real audit-log entries, the
              x402 endpoint returns real onchain receipts, and the cause-coin launcher deploys real
              Token-2022 mints on Solana devnet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── status (build state, not pricing) ────────────────────────────────── */

function Status() {
  return (
    <section
      id="status"
      className="bg-[var(--cream)] py-32 text-[var(--matcha-deep)] sm:py-40"
    >
      <div className="mx-auto max-w-[1400px] px-8 sm:px-12">
        <div className="mb-16 max-w-3xl">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
            (status)
          </div>
          <h2 className="r-display mt-4 text-[10vw] font-medium leading-[0.95] tracking-tight sm:text-[6vw] md:text-[85px]">
            Where this{" "}
            <span className="r-italic font-light text-[var(--strawberry-deep)]">is</span> right now
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatusCard
            phase="v1 prototype"
            tone="green"
            blurb="11 connectors mocked with seed data. Agent runtime + chat UI live. Audit log persists. CSV export works. Demo tenant Rivertown pre-seeded across every tool."
          />
          <StatusCard
            phase="onchain"
            tone="green"
            blurb="x402 endpoint settles real USDC on Solana devnet. Token-2022 cause coins deploy with onchain metadata + 1B initial supply, no freeze authority. Tax-receipt PDFs HMAC-signed."
          />
          <StatusCard
            phase="post-hackathon"
            tone="amber"
            blurb="Real OAuth on each connector. Mainnet deploy gated on securities counsel review. Recurring x402 cron via Inngest in production. Multi-tenant with Privy server wallets."
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard?demo=rivertown"
            className="rounded-none bg-[var(--matcha-deep)] px-5 py-3 text-sm uppercase tracking-[0.15em] text-[var(--cream)] transition-transform hover:scale-[1.02]"
          >
            Open the dashboard
          </Link>
          <Link
            href="/crypto"
            className="rounded-none border border-[var(--matcha-deep)]/20 px-5 py-3 text-sm uppercase tracking-[0.15em] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]"
          >
            Crypto desk
          </Link>
          <a
            href="https://github.com/stephenhungg/kali-v0"
            className="rounded-none border border-[var(--matcha-deep)]/20 px-5 py-3 text-sm uppercase tracking-[0.15em] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]"
          >
            GitHub →
          </a>
        </div>
      </div>
    </section>
  );
}

function StatusCard({
  phase,
  tone,
  blurb,
}: {
  phase: string;
  tone: "green" | "amber";
  blurb: string;
}) {
  const dotColor = tone === "green" ? "var(--matcha-mid)" : "var(--strawberry-deep)";
  const labelText = tone === "green" ? "shipping" : "post-v1";
  return (
    <article className="flex flex-col gap-6 border border-[var(--matcha-deep)]/15 bg-[var(--surface)] p-8">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dotColor }}
        />
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
          {labelText}
        </span>
      </div>
      <h3 className="r-display text-3xl font-medium tracking-tight">{phase}</h3>
      <p className="text-sm leading-relaxed text-[var(--matcha-deep)]/70">{blurb}</p>
    </article>
  );
}

/* ─── footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-[var(--matcha-deep)] text-[var(--cream)]">
      <div className="border-t border-[var(--cream)]/10">
        <div className="mx-auto flex max-w-[1400px] items-end justify-between px-8 py-20 sm:px-12 sm:py-32">
          <h2 className="r-display text-[14vw] font-medium leading-[0.9] tracking-tight sm:text-[10vw] md:text-[150px]">
            Try{" "}
            <span className="r-italic font-light text-[var(--strawberry-soft)]">it</span>
          </h2>
          <Link
            href="/dashboard?demo=rivertown"
            className="hidden h-32 w-32 items-center justify-center rounded-full border border-[var(--cream)]/20 transition-transform hover:scale-105 md:flex"
            aria-label="Open the demo"
          >
            <span className="text-3xl">→</span>
          </Link>
        </div>
      </div>

      <div className="overflow-hidden border-t border-[var(--cream)]/10">
        <div className="r-display flex animate-r-marquee whitespace-nowrap py-6 text-[18vw] font-medium tracking-tighter text-[var(--cream)] sm:text-[16vw]">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="mx-6 inline-flex items-center gap-6">
              kali
              <span className="text-[var(--strawberry-deep)]">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--cream)]/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-8 py-6 text-xs uppercase tracking-[0.15em] text-[var(--cream)]/60 sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <span>© Kali — HackDavis 2026</span>
          <span>Stephen Hung · Matthew Kim · Silas Wu · Jake Li</span>
        </div>
      </div>
    </footer>
  );
}
