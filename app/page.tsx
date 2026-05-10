import Link from "next/link";
import { QueryDemo } from "@/components/marketing/QueryDemo";
import { HeroDisplay } from "@/components/marketing/HeroDisplay";
import { CountUp } from "@/components/marketing/CountUp";
import { RevealStack } from "@/components/marketing/RevealStack";

const SERVICES = [
  { num: "01", label: "agentic context layer" },
  { num: "02", label: "eleven saas connectors" },
  { num: "03", label: "onchain payouts" },
  { num: "04", label: "audit + citations" },
] as const;

const QUERIES = [
  {
    title: "find the donors who matter",
    body: "lapsed donors who gave $1k+ in 2024, attended ≥2 events, work at companies with active matching gifts, no re-engagement email in 90 days.",
    sources: ["bloomerang", "salesforce", "zoom", "m365"],
  },
  {
    title: "never miss a grant",
    body: "what grants closing in the next 30 days am i eligible for, and which board members or major donors have ties to those funders?",
    sources: ["instrumentl", "salesforce", "sharepoint"],
  },
  {
    title: "cash and programs in one view",
    body: "show our cash runway against projected program spend over the next 90 days. flag programs at risk of going over budget, with citations.",
    sources: ["quickbooks", "sharepoint", "powerbi"],
  },
  {
    title: "send the money in 400ms",
    body: "we just got awarded $50k. disburse $25k to our partner, stipend the board for this quarter, refund the two donors from the cancelled gala.",
    sources: ["instrumentl", "salesforce", "bloomerang", "solana", "quickbooks"],
    highlight: true,
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#17191a] text-zinc-100 antialiased">
      <Header />
      <HeroDisplay />
      <ServicesBar />
      <section className="mx-auto max-w-7xl px-6 sm:px-10">
        <QueryDemo />
      </section>
      <Why />
      <Queries />
      <Footer />
    </main>
  );
}

/* ─── header ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 sm:px-10">
      <div className="flex items-center gap-3">
        <KaliMark className="h-5 w-5 text-[#cbf478]" />
        <span className="font-display text-lg font-semibold tracking-tight kali-mark">
          kali
        </span>
      </div>
      <nav className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 md:flex">
        <a href="#what" className="transition-colors hover:text-white">
          what
        </a>
        <a href="#why" className="transition-colors hover:text-white">
          why
        </a>
        <a href="#queries" className="transition-colors hover:text-white">
          queries
        </a>
      </nav>
      <Link
        href="https://github.com/stephenhungg/kali-v0"
        className="inline-flex items-center gap-2 bg-[#cbf478] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition-transform hover:scale-[1.02]"
      >
        view repo
      </Link>
    </header>
  );
}

function KaliMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="3.5" fill="currentColor" />
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="2.5" cy="10" r="1" fill="currentColor" opacity="0.7" />
      <circle cx="17.5" cy="10" r="1" fill="currentColor" opacity="0.7" />
      <circle cx="10" cy="2.5" r="1" fill="currentColor" opacity="0.7" />
      <circle cx="10" cy="17.5" r="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ─── services bar ─────────────────────────────────────────────────────── */

function ServicesBar() {
  return (
    <section
      id="what"
      className="border-y border-white/10 bg-[#0e1011] py-3 overflow-hidden"
    >
      <div className="flex animate-[scroll_25s_linear_infinite] whitespace-nowrap font-display text-3xl font-medium text-zinc-400 sm:text-4xl">
        {[...SERVICES, ...SERVICES, ...SERVICES].map((s, i) => (
          <span key={`${s.num}-${i}`} className="mx-8 inline-flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#cbf478]">
              {s.num}
            </span>
            <span>{s.label}</span>
            <span className="ml-8 text-[#cbf478]">✦</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }`}</style>
    </section>
  );
}

/* ─── why ──────────────────────────────────────────────────────────────── */

function Why() {
  return (
    <section id="why" className="mx-auto max-w-7xl px-6 py-32 sm:px-10 sm:py-40">
      <RevealStack className="grid grid-cols-1 gap-12 md:grid-cols-12">
        <div data-reveal className="md:col-span-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#cbf478]">
            01 / why
          </div>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl">
            small foundations bleed{" "}
            <span className="text-[#cbf478]">$8–12k</span> a year on payment
            friction alone.
          </h2>
        </div>
        <div data-reveal className="md:col-span-7 md:pl-8">
          <p className="text-balance text-lg leading-relaxed text-zinc-400 sm:text-xl">
            $400k a year in vendor payments, board stipends, grant
            disbursements. ach delays, wire fees, reconciliation hell. that
            $8–12k is a part-time staffer they could&apos;ve hired.
          </p>
          <RevealStack
            className="mt-12 grid grid-cols-1 gap-0 sm:grid-cols-3"
            stagger={0.12}
          >
            <Stat
              valueRaw={
                <CountUp
                  to={0.0001}
                  prefix="$"
                  decimals={4}
                  duration={2.0}
                  className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                />
              }
              label="solana txn fee"
            />
            <Stat
              valueRaw={
                <span className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  <CountUp to={400} duration={1.4} />
                  ms
                </span>
              }
              label="settlement"
            />
            <Stat
              valueRaw={
                <CountUp
                  to={11}
                  duration={1.2}
                  className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                />
              }
              label="tools unified"
            />
          </RevealStack>
        </div>
      </RevealStack>
    </section>
  );
}

function Stat({
  valueRaw,
  label,
}: {
  valueRaw: React.ReactNode;
  label: string;
}) {
  return (
    <div
      data-reveal
      className="border-l border-white/10 px-6 py-4 first:border-l-0 first:pl-0 sm:border-l sm:first:border-l"
    >
      <div>{valueRaw}</div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
    </div>
  );
}

/* ─── queries ──────────────────────────────────────────────────────────── */

function Queries() {
  return (
    <section
      id="queries"
      className="mx-auto max-w-7xl scroll-mt-12 px-6 py-32 sm:px-10 sm:py-40"
    >
      <RevealStack className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div data-reveal>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#cbf478]">
            02 / queries
          </div>
          <h2 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl">
            four questions <span className="text-[#cbf478]">no other tool</span>{" "}
            can answer.
          </h2>
        </div>
        <p data-reveal className="max-w-md text-zinc-400">
          each one runs across 3–5 sources in a single turn. cited, exportable,
          live on stage in under 8 seconds.
        </p>
      </RevealStack>

      <RevealStack
        className="mt-16 grid grid-cols-1 gap-0 md:grid-cols-2"
        stagger={0.1}
      >
        {QUERIES.map((q, i) => (
          <article
            key={q.title}
            data-reveal
            className={[
              "border border-white/10 p-8 transition-colors hover:bg-white/[0.02]",
              i % 2 === 1 ? "md:border-l-0" : "",
              i >= 2 ? "md:border-t-0" : "",
              "highlight" in q && q.highlight ? "bg-[#cbf478]/[0.04]" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <span className="text-[#cbf478]">0{i + 1}</span>
              <span>{q.title}</span>
              {"highlight" in q && q.highlight ? (
                <span className="bg-[#cbf478] px-2 py-0.5 text-[10px] text-black">
                  the wow
                </span>
              ) : null}
            </div>
            <p className="mt-5 font-display text-xl font-medium leading-snug text-white sm:text-2xl">
              {q.body}
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
              {q.sources.map((s) => (
                <span key={s} className="border border-white/10 px-2 py-1">
                  {s}
                </span>
              ))}
            </div>
          </article>
        ))}
      </RevealStack>
    </section>
  );
}

/* ─── footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0e1011]">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="font-display text-[14vw] font-semibold leading-[0.85] tracking-tighter text-zinc-700 sm:text-[12vw] md:text-[140px]">
          let&apos;s build it
          <span className="text-[#cbf478]">.</span>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KaliMark className="h-4 w-4 text-[#cbf478]" />
              <span className="font-display text-base font-semibold tracking-tight kali-mark">
                kali
              </span>
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              v1 prototype · agentic context layer for nonprofits · scope at{" "}
              <code className="text-zinc-300">data/v1-prototype-scope.md</code>
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            built by stephen, matty, frank, nicole · hackdavis 2026
          </div>
        </div>
      </div>
    </footer>
  );
}
