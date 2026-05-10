import Link from "next/link";
import { QueryDemo } from "@/components/marketing/QueryDemo";

const TRACKS = [
  "best user research",
  "best use of solana",
  "best ui/ux",
  "most challenging hack",
  "best technically challenging",
  "best hack for social good",
] as const;

const QUERIES = [
  {
    title: "donor intelligence",
    body: "lapsed donors who gave $1k+ in 2024, attended ≥2 events, work at companies with active matching gifts, no re-engagement email in 90d.",
    sources: ["bloomerang", "salesforce", "zoom", "m365"],
  },
  {
    title: "grant ops",
    body: "what grants closing in the next 30 days am i eligible for, and which board members or major donors have ties to those funders?",
    sources: ["instrumentl", "salesforce", "sharepoint"],
  },
  {
    title: "finance ↔ programs",
    body: "show our cash runway against projected program spend over the next 90 days. flag programs at risk of going over budget.",
    sources: ["quickbooks", "sharepoint", "powerbi"],
  },
  {
    title: "the onchain money moment",
    body: "we just got awarded $50k. disburse $25k to our partner, stipend the board for this quarter, refund the two donors from the cancelled gala.",
    sources: ["instrumentl", "salesforce", "bloomerang", "solana", "quickbooks"],
    highlight: true,
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-zinc-100 antialiased">
      <BackgroundGlow />

      <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-10">
        <Header />
        <Hero />
        <section className="mt-16 sm:mt-24">
          <QueryDemo />
        </section>
        <Why />
        <Queries />
        <Footer />
      </div>
    </main>
  );
}

/* ─── header ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="flex items-center justify-between pt-8 sm:pt-10">
      <div className="flex items-center gap-3">
        <KaliMark className="h-5 w-5" />
        <span className="font-mono text-sm tracking-tight text-zinc-300">
          kali
        </span>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
        hackdavis · 2026
      </span>
    </header>
  );
}

function KaliMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
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
    <section className="pt-20 sm:pt-32">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        building for nonprofits
      </div>

      <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
        nonprofits run on{" "}
        <span className="text-zinc-500">eleven disconnected tools.</span>
        <br />
        kali makes them{" "}
        <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
          one brain.
        </span>
      </h1>

      <p className="mt-8 max-w-2xl text-balance text-base leading-relaxed text-zinc-400 sm:text-lg">
        ask anything in plain english across quickbooks, salesforce, sharepoint,
        m365, bloomerang, instrumentl, zoom, knowbe4, power bi, power automate,
        and onchain payouts on solana — get an answer with citations, not a tab
        graveyard.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="https://github.com/stephenhungg/kali-v0"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-mono text-sm text-black transition-transform hover:scale-[1.02]"
        >
          view the repo →
        </Link>
        <Link
          href="#queries"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 font-mono text-sm text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
        >
          see the demo
        </Link>
      </div>

      <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-widest text-zinc-600">
        {TRACKS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

/* ─── why this matters (the social-good cut) ───────────────────────────── */

function Why() {
  return (
    <section className="mt-32 sm:mt-40">
      <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        why this exists
      </div>
      <h2 className="mt-3 max-w-3xl text-balance text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
        a small foundation moves $400k/yr in vendor payments and grant
        disbursements. they bleed{" "}
        <span className="text-zinc-100">$8–12k</span> a year to wire fees and
        ach delays.
      </h2>
      <p className="mt-6 max-w-2xl text-balance leading-relaxed text-zinc-400">
        they also lose hours every week to spreadsheet archaeology — chasing
        donor history across bloomerang, salesforce, m365, and zoom because
        none of those tools talk. kali ends both.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat value="$0.0001" label="solana txn fee" sub="vs ach $1.50 floor" />
        <Stat value="400ms" label="onchain finality" sub="vs ach 3-day wait" />
        <Stat value="11" label="tools unified" sub="one chat, one brain" />
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="text-3xl font-medium tracking-tight text-zinc-100 sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
        {label}
      </div>
      <div className="mt-3 text-sm text-zinc-500">{sub}</div>
    </div>
  );
}

/* ─── demo queries ─────────────────────────────────────────────────────── */

function Queries() {
  return (
    <section id="queries" className="mt-32 scroll-mt-12 sm:mt-40">
      <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        the wow queries
      </div>
      <h2 className="mt-3 max-w-3xl text-balance text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
        four questions no other tool can answer.
      </h2>
      <p className="mt-4 max-w-2xl text-zinc-400">
        each one runs across 3–5 sources in a single turn. cited. exportable.
        live in front of judges in under 8 seconds.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUERIES.map((q) => (
          <article
            key={q.title}
            className={[
              "rounded-xl border p-6 transition-colors",
              "highlight" in q && q.highlight
                ? "border-emerald-400/30 bg-gradient-to-b from-emerald-400/[0.04] to-transparent"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/15",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              {q.title}
              {"highlight" in q && q.highlight ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300">
                  the wow
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-balance leading-relaxed text-zinc-200">
              {q.body}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {q.sources.map((s) => (
                <span
                  key={s}
                  className="rounded border border-white/[0.06] bg-black/30 px-2 py-1"
                >
                  {s}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ─── footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="mt-32 border-t border-white/[0.06] py-10 sm:mt-40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KaliMark className="h-4 w-4" />
            <span className="font-mono text-sm tracking-tight text-zinc-300">
              kali
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
            v1 prototype · agentic context layer for nonprofits · scope at{" "}
            <code className="text-zinc-400">data/v1-prototype-scope.md</code>
          </p>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">
          built by stephen, matty, frank, nicole · hackdavis 2026
        </div>
      </div>
    </footer>
  );
}

/* ─── decorative background ────────────────────────────────────────────── */

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[600px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(52, 211, 153, 0.10), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[300px] -z-0 h-[400px] w-[500px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(167, 139, 250, 0.10), transparent 70%)",
        }}
      />
    </>
  );
}
