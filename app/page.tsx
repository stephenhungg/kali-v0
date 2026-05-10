import Link from "next/link";

export default function HomePage() {
  return (
    <main className="bg-[var(--matcha-deep)] text-[var(--cream)] antialiased">
      <Header />
      <Hero />
      <Projects />
      <DreamToReality />
      <Stats />
      <Pricing />
      <Testimonial />
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
        <span className="r-display text-2xl font-medium tracking-tight">
          kali
        </span>
      </div>
      <nav className="hidden items-center gap-10 text-sm md:flex">
        <a href="#projects" className="transition-colors hover:text-[var(--strawberry-soft)]">
          Projects
        </a>
        <a href="#pricing" className="transition-colors hover:text-[var(--strawberry-soft)]">
          Pricing
        </a>
        <a href="#about" className="transition-colors hover:text-[var(--strawberry-soft)]">
          About
        </a>
      </nav>
      <Link
        href="https://github.com/stephenhungg/kali-v0"
        className="inline-flex items-center gap-2 bg-[var(--cream)] px-5 py-2.5 text-sm text-[var(--matcha-deep)] transition-transform hover:scale-[1.02]"
      >
        Get started
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
      {/* photo strip — desert-style soft palette photos overlapping the text */}
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
        {/* eyebrow */}
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
          (introduction)
        </div>

        {/* stacked headlines — radiance signature */}
        <h1 className="r-display mt-8 text-[18vw] font-medium leading-[0.9] tracking-tight text-[var(--matcha-deep)] sm:text-[14vw] md:text-[200px]">
          <span className="block">Plan</span>
          <span className="block">
            <span className="r-italic font-light text-[var(--strawberry-deep)]">
              Create
            </span>
          </span>
          <span className="block">Realize it.</span>
        </h1>

        {/* bottom row */}
        <div className="mt-auto flex flex-col gap-6 pb-12 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/70">
            <span className="inline-block h-3 w-3 animate-bounce rounded-full bg-[var(--strawberry-deep)]" />
            Scroll down
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--matcha-deep)]/70 sm:text-base">
            We&apos;re masters of inventive strategies. Accuracy, creativity,
            and the passion for perfection define our approach, making us a
            partner of choice for nonprofits.
          </p>
          <a
            href="#about"
            className="inline-flex items-center gap-2 self-start border border-[var(--matcha-deep)]/20 bg-transparent px-5 py-2.5 text-sm text-[var(--matcha-deep)] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)] md:self-end"
          >
            About us →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── projects ─────────────────────────────────────────────────────────── */

const PROJECTS = [
  {
    name: "Innovative Roots",
    tags: ["Web design", "Brand Identity"],
    img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200&q=80",
  },
  {
    name: "Minimalist Mind",
    tags: ["Web Design", "Brand Identity"],
    img: "https://images.unsplash.com/photo-1620207418302-439b387441b0?w=1200&q=80",
  },
  {
    name: "Commerce Catalyst",
    tags: ["Social Media Integration"],
    img: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=1200&q=80",
  },
  {
    name: "Digital Avenue",
    tags: ["Web Design"],
    img: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80",
  },
] as const;

function Projects() {
  return (
    <section
      id="projects"
      className="bg-[var(--cream)] text-[var(--matcha-deep)]"
    >
      <div className="mx-auto max-w-[1400px] px-8 py-32 sm:px-12 sm:py-40">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
              (Projects)
            </div>
            <h2 className="r-display mt-4 text-[12vw] font-medium leading-[0.9] tracking-tight text-[var(--matcha-deep)] sm:text-[8vw] md:text-[120px]">
              Recent <span className="r-italic font-light text-[var(--strawberry-deep)]">projects</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--matcha-deep)]/70 sm:text-base">
            Highlighting the exceptional in our latest grand projects.
            Delivering creativity and quality in every effort.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PROJECTS.map((p, i) => (
            <article
              key={p.name}
              className={`group relative overflow-hidden ${
                i === 0 ? "md:col-span-2" : ""
              }`}
            >
              <div
                className="aspect-[4/3] w-full bg-[var(--matcha-mid)] transition-transform duration-[800ms] [transition-timing-function:var(--r-ease)] group-hover:scale-[1.02]"
                style={{
                  backgroundImage: `url(${p.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="r-display text-2xl font-medium tracking-tight sm:text-3xl">
                    {p.name}
                  </h3>
                  <div className="mt-1 text-sm text-[var(--matcha-deep)]/60">
                    — {p.tags.join(", ")}
                  </div>
                </div>
                <button className="inline-flex items-center gap-1 border border-[var(--matcha-deep)]/20 px-4 py-1.5 text-xs uppercase tracking-[0.15em] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]">
                  View
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <button className="inline-flex items-center gap-2 border border-[var(--matcha-deep)]/30 px-6 py-3 text-sm uppercase tracking-[0.15em] transition-colors hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]">
            See all work →
          </button>
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
            From{" "}
            <span className="r-italic font-light text-[var(--strawberry-soft)]">
              dream
            </span>{" "}
            to reality
            <span className="text-[var(--strawberry-deep)]">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── stats ────────────────────────────────────────────────────────────── */

const STATS = [
  { value: "93", label: "realized projects" },
  { value: "14", label: "awards won" },
  { value: "35", label: "team members" },
] as const;

function Stats() {
  return (
    <section
      id="about"
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
              By combining our professional strengths and engaging in
              exchanges, we have created a cooperative atmosphere in which
              collaboration thrives. Fueled by enthusiasm, a team of young
              innovators are poised to craft something extraordinary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── pricing ──────────────────────────────────────────────────────────── */

const PRICING = [
  {
    name: "Just design",
    price: "$1999",
    period: "/mo",
    note: "Pause or cancel anytime",
    features: [
      "Unlimited projects",
      "One request at a time",
      "Average 48 hour delivery",
      "Easy one-click payments",
      "Unlimited stock assets",
    ],
  },
  {
    name: "Design + development",
    price: "$2499",
    period: "/mo",
    note: "Pause or cancel anytime",
    features: [
      "Unlimited projects",
      "One request at a time",
      "Average 48 hour delivery",
      "Easy one-click payments",
      "Webflow development",
    ],
    featured: true,
  },
] as const;

function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-[var(--cream)] py-32 text-[var(--matcha-deep)] sm:py-40"
    >
      <div className="mx-auto max-w-[1400px] px-8 sm:px-12">
        <div className="mb-20 max-w-3xl">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--matcha-deep)]/60">
            (Pricing)
          </div>
          <h2 className="r-display mt-4 text-[10vw] font-medium leading-[0.95] tracking-tight sm:text-[6vw] md:text-[85px]">
            Fueled by <span className="r-italic font-light text-[var(--strawberry-deep)]">enthusiasm</span>, a team of young innovators are poised to craft something extraordinary.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PRICING.map((p) => (
            <article
              key={p.name}
              className={`flex flex-col border border-[var(--matcha-deep)]/15 p-8 ${
                "featured" in p && p.featured
                  ? "bg-[var(--matcha-deep)] text-[var(--cream)]"
                  : "bg-[var(--cream)]"
              }`}
            >
              <div className="text-sm uppercase tracking-[0.15em] opacity-70">
                {p.name}
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="r-display text-6xl font-medium tracking-tight sm:text-7xl">
                  {p.price}
                </span>
                <span className="text-base opacity-60">{p.period}</span>
              </div>
              <div className="mt-2 text-sm opacity-60">{p.note}</div>
              <ul className="mt-8 space-y-3 text-base">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="inline-block h-1.5 w-1.5 bg-current opacity-70" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  className={`flex-1 px-5 py-3 text-sm uppercase tracking-[0.15em] transition-transform hover:scale-[1.02] ${
                    "featured" in p && p.featured
                      ? "bg-[var(--cream)] text-[var(--matcha-deep)]"
                      : "bg-[var(--matcha-deep)] text-[var(--cream)]"
                  }`}
                >
                  Get started
                </button>
                <button
                  className={`flex-1 border px-5 py-3 text-sm uppercase tracking-[0.15em] transition-colors ${
                    "featured" in p && p.featured
                      ? "border-[var(--cream)]/30 hover:bg-[var(--cream)] hover:text-[var(--matcha-deep)]"
                      : "border-[var(--matcha-deep)]/20 hover:bg-[var(--matcha-deep)] hover:text-[var(--cream)]"
                  }`}
                >
                  Book a call
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── testimonial ──────────────────────────────────────────────────────── */

function Testimonial() {
  return (
    <section className="bg-[var(--matcha-deep)] py-32 text-[var(--cream)] sm:py-40">
      <div className="mx-auto max-w-[1100px] px-8 text-center sm:px-12">
        <div className="r-italic text-6xl text-[var(--strawberry-soft)] sm:text-8xl">
          “
        </div>
        <blockquote className="r-display mt-2 text-balance text-2xl font-medium leading-snug tracking-tight sm:text-4xl md:text-5xl">
          The team behind our project demonstrated exceptional creativity and
          flawless execution. Their{" "}
          <span className="r-italic font-light text-[var(--strawberry-soft)]">
            collaborative
          </span>{" "}
          approach and attention to detail truly stand out.
        </blockquote>
        <div className="mt-12 flex flex-col items-center gap-1">
          <div className="text-base">Emma Smith</div>
          <div className="text-sm opacity-60">— CEO Neeqola</div>
        </div>
        <div className="mt-12 flex justify-center gap-8 font-mono text-xs uppercase tracking-[0.18em] text-[var(--cream)]/40">
          <span>Innovative</span>
          <span aria-hidden>•</span>
          <span>Imaginative</span>
          <span aria-hidden>•</span>
          <span>Astute</span>
        </div>
      </div>
    </section>
  );
}

/* ─── footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-[var(--matcha-deep)] text-[var(--cream)]">
      {/* big "Connect with us" CTA row */}
      <div className="border-t border-[var(--cream)]/10">
        <div className="mx-auto flex max-w-[1400px] items-end justify-between px-8 py-20 sm:px-12 sm:py-32">
          <h2 className="r-display text-[14vw] font-medium leading-[0.9] tracking-tight sm:text-[10vw] md:text-[150px]">
            Connect <br />
            <span className="r-italic font-light text-[var(--strawberry-soft)]">
              with us
            </span>
          </h2>
          <Link
            href="https://github.com/stephenhungg/kali-v0"
            className="hidden h-32 w-32 items-center justify-center rounded-full border border-[var(--cream)]/20 transition-transform hover:scale-105 md:flex"
            aria-label="Get in touch"
          >
            <span className="text-3xl">→</span>
          </Link>
        </div>
      </div>

      {/* gigantic wordmark marquee */}
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

      {/* bottom bar */}
      <div className="border-t border-[var(--cream)]/10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-8 py-6 text-xs uppercase tracking-[0.15em] text-[var(--cream)]/60 sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <span>© Kali — HackDavis 2026</span>
          <span>Built by Stephen, Matty, Frank, Nicole</span>
        </div>
      </div>
    </footer>
  );
}
