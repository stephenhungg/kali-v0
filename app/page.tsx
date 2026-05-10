import Link from "next/link";
import { QueryDemo } from "@/components/marketing/QueryDemo";

const STORIES = [
  {
    name: "Sarah",
    title: "Director of Development",
    quote:
      "I spend 6 hours every week stitching together donor history from four different systems. That's not the work I came here to do.",
  },
  {
    name: "Marcus",
    title: "Program Officer",
    quote:
      "Grant deadlines slip through the cracks because nobody can see across instrumentl, salesforce, and our shared drive at once.",
  },
  {
    name: "Elena",
    title: "Finance Manager",
    quote:
      "Wire fees and ach delays cost us $11,000 last year. On a small budget, that's a part-time staffer we couldn't hire.",
  },
] as const;

const QUERIES = [
  {
    title: "find the donors who matter",
    body: "lapsed donors who gave $1k+ last year, attended at least two events, work at companies with active matching gifts, no re-engagement email in 90 days.",
    sources: ["bloomerang", "salesforce", "zoom", "m365"],
  },
  {
    title: "never miss a grant",
    body: "what grants closing in the next 30 days am i eligible for, and which board members or major donors have ties to those funders?",
    sources: ["instrumentl", "salesforce", "sharepoint"],
  },
  {
    title: "see your cash and your programs together",
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
    <main className="relative min-h-screen overflow-hidden bg-amber-50/40 text-stone-900 antialiased">
      <BackgroundGlow />

      <div className="relative z-10 mx-auto max-w-5xl px-6 sm:px-10">
        <Header />
        <Hero />
        <section className="mt-14 sm:mt-20">
          <QueryDemo />
        </section>
        <Stories />
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
        <KaliMark className="h-5 w-5 text-amber-700" />
        <span className="font-serif text-xl tracking-tight text-stone-800">
          kali
        </span>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
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
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-900/10 bg-white/70 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-900/70">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
        built for the staff actually doing the work
      </div>

      <h1 className="text-balance font-serif text-4xl leading-[1.05] tracking-tight text-stone-900 sm:text-6xl md:text-7xl">
        nonprofits don&apos;t need{" "}
        <span className="text-stone-500">more software.</span>
        <br />
        they need their software to{" "}
        <span className="bg-gradient-to-r from-amber-700 via-rose-500 to-amber-600 bg-clip-text text-transparent">
          finally talk to each other.
        </span>
      </h1>

      <p className="mt-8 max-w-2xl text-balance text-lg leading-relaxed text-stone-600 sm:text-xl">
        kali is a single chat that reasons across the eleven tools every modern
        nonprofit runs on. ask in plain english, get a real answer with
        citations, and skip the spreadsheet archaeology.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="https://github.com/stephenhungg/kali-v0"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 font-mono text-sm text-amber-50 transition-transform hover:scale-[1.02]"
        >
          view the repo →
        </Link>
        <Link
          href="#queries"
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/60 px-5 py-2.5 font-mono text-sm text-stone-700 transition-colors hover:border-stone-500 hover:text-stone-900"
        >
          see the demo
        </Link>
      </div>
    </section>
  );
}

/* ─── stories ──────────────────────────────────────────────────────────── */

function Stories() {
  return (
    <section className="mt-28 sm:mt-36">
      <div className="font-mono text-[11px] uppercase tracking-widest text-amber-900/60">
        the people we&apos;re building for
      </div>
      <h2 className="mt-3 max-w-3xl text-balance font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">
        the staff at small foundations spend their days as detectives, not
        program officers.
      </h2>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {STORIES.map((s) => (
          <article
            key={s.name}
            className="rounded-2xl border border-amber-900/10 bg-white/60 p-6 backdrop-blur-sm"
          >
            <p className="font-serif text-base italic leading-relaxed text-stone-700">
              “{s.quote}”
            </p>
            <div className="mt-5 border-t border-amber-900/10 pt-4">
              <div className="font-medium text-stone-800">{s.name}</div>
              <div className="text-sm text-stone-500">{s.title}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ─── why this matters ─────────────────────────────────────────────────── */

function Why() {
  return (
    <section className="mt-28 sm:mt-36">
      <div className="rounded-3xl border border-amber-900/10 bg-gradient-to-br from-amber-100/60 via-rose-50/40 to-amber-50/40 p-8 sm:p-12">
        <div className="font-mono text-[11px] uppercase tracking-widest text-amber-900/60">
          why this matters
        </div>
        <h2 className="mt-3 max-w-3xl text-balance font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">
          a small foundation moves $400k/yr in payments. they bleed{" "}
          <span className="text-amber-800">$8–12k</span> a year on wires and
          ach delays alone.
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-stone-600">
          on a tight budget, that&apos;s a part-time staffer they could&apos;ve
          hired. solana payouts cost a fraction of a cent and clear in 400
          milliseconds. kali makes the savings real.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Stat value="$0.0001" label="solana txn fee" sub="vs ach $1.50 floor" />
          <Stat value="400ms" label="settlement time" sub="vs ach 3-day wait" />
          <Stat value="11" label="tools unified" sub="one chat, one brain" />
        </div>
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
    <div className="rounded-2xl border border-amber-900/10 bg-white/70 p-6">
      <div className="font-serif text-3xl tracking-tight text-stone-900 sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-amber-900/60">
        {label}
      </div>
      <div className="mt-3 text-sm text-stone-500">{sub}</div>
    </div>
  );
}

/* ─── queries ──────────────────────────────────────────────────────────── */

function Queries() {
  return (
    <section id="queries" className="mt-28 scroll-mt-12 sm:mt-36">
      <div className="font-mono text-[11px] uppercase tracking-widest text-amber-900/60">
        what kali helps with
      </div>
      <h2 className="mt-3 max-w-3xl text-balance font-serif text-3xl leading-tight tracking-tight text-stone-900 sm:text-4xl">
        four real questions, answered live, across multiple tools.
      </h2>
      <p className="mt-4 max-w-2xl text-stone-600">
        each one runs across three to five sources in a single turn — cited,
        exportable, demo-ready in under eight seconds.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUERIES.map((q) => (
          <article
            key={q.title}
            className={[
              "rounded-2xl border p-6 transition-colors",
              "highlight" in q && q.highlight
                ? "border-amber-700/30 bg-gradient-to-br from-amber-100/70 to-rose-50/50"
                : "border-amber-900/10 bg-white/60 hover:border-amber-900/30",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-amber-900/60">
              {q.title}
              {"highlight" in q && q.highlight ? (
                <span className="rounded-full bg-amber-700/15 px-2 py-0.5 text-[10px] text-amber-800">
                  the wow
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-balance font-serif text-base leading-relaxed text-stone-800">
              {q.body}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {q.sources.map((s) => (
                <span
                  key={s}
                  className="rounded border border-amber-900/10 bg-white/70 px-2 py-1"
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
    <footer className="mt-28 border-t border-amber-900/10 py-12 sm:mt-36">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KaliMark className="h-4 w-4 text-amber-700" />
            <span className="font-serif text-base tracking-tight text-stone-800">
              kali
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500">
            v1 prototype · agentic context layer for nonprofits · scope at{" "}
            <code className="text-stone-700">data/v1-prototype-scope.md</code>
          </p>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-stone-500">
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
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[700px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(251, 191, 36, 0.18), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-[300px] -z-0 h-[500px] w-[600px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(244, 114, 182, 0.10), transparent 70%)",
        }}
      />
    </>
  );
}
