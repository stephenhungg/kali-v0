"use client";

import Image from "next/image";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { KaliWordmark, MiniKaliWordmark, ReceiptSticker } from "@/components/brand/KawaiiBrand";
import { KaliBaitIntro } from "@/components/landing/KaliBaitIntro";
import { SparkleField } from "@/components/landing/SparkleField";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const HERO_DRIFT = -197;

const WORK_ITEMS = [
  {
    n: "01",
    title: "donor reactivation",
    tags: ["Salesforce", "Gmail"],
    blurb: "Find lapsed donors across the CRM, draft warm outreach in your voice, send only after you approve.",
    src: "/kawaii/generated/work-donor-v2.png",
    alt: "kawaii sticker scene of a matcha mascot reactivating donor outreach",
  },
  {
    n: "02",
    title: "grant research",
    tags: ["Drive", "Docs"],
    blurb: "Pull eligibility, deadlines, and program fit across your grants folder. Every claim cited back to the source doc.",
    src: "/kawaii/generated/work-grant-v2.png",
    alt: "kawaii sticker scene of a matcha mascot reading grant documents",
  },
  {
    n: "03",
    title: "volunteer ops",
    tags: ["Calendar", "Slack"],
    blurb: "Schedule shifts, send reminders, fill cancellations. Coordinated across calendar and Slack with one ask.",
    src: "/kawaii/generated/work-volunteer-v2.png",
    alt: "kawaii sticker scene of a matcha mascot waving a calendar of volunteer days",
  },
];

export default function HomePage() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        gsap.set("[data-appear], .hero-line, [data-selected-drift]", { autoAlpha: 1, x: 0, y: 0, yPercent: 0 });
        return;
      }

      gsap.from(".hero-line", {
        yPercent: 100,
        autoAlpha: 0,
        duration: 1,
        stagger: 0.1,
        ease: "expo.out",
      });

      gsap.utils.toArray<HTMLElement>("[data-appear]").forEach((el) => {
        const delay = Number(el.dataset.appearDelay ?? 0);
        gsap.from(el, {
          autoAlpha: 0,
          y: 24,
          duration: 0.65,
          delay,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-scatter-parallax]").forEach((el) => {
        const target = Number(el.dataset.parallaxY ?? HERO_DRIFT);
        gsap.fromTo(
          el,
          { y: 0 },
          {
            y: target,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-hero]",
              start: "top top",
              end: "+=1967",
              scrub: true,
            },
          }
        );
      });

      gsap.to("[data-hero-brand]", {
        autoAlpha: 0,
        y: -8,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-hero]",
          start: "bottom 320px",
          end: "bottom 180px",
          scrub: true,
        },
      });

      const selectedWork = rootRef.current?.querySelector<HTMLElement>("[data-selected-work]");
      const mm = gsap.matchMedia();
      if (selectedWork) {
        mm.add("(min-width: 768px)", () => {
          const driftTrigger = () => ({
            trigger: selectedWork,
            start: "top+=327 top",
            end: "bottom top",
            scrub: true,
          });

          gsap.to("[data-selected-drift='left']", {
            x: -185,
            ease: "none",
            scrollTrigger: driftTrigger(),
          });
          gsap.to("[data-selected-drift='right']", {
            x: 185,
            ease: "none",
            scrollTrigger: driftTrigger(),
          });
          gsap.to("[data-selected-drift='label']", {
            x: 185,
            ease: "none",
            scrollTrigger: driftTrigger(),
          });
        });
      }

      ScrollTrigger.refresh();
      return () => mm.revert();
    },
    { scope: rootRef }
  );

  return (
    <KaliBaitIntro>
      <main id="top" ref={rootRef} className="matcha-page min-h-screen font-subtext text-ink-near antialiased">
        <h1 className="sr-only">
          Kali is an agentic context layer for nonprofits, bringing answers across tools into one cited chat.
        </h1>
        <StickyNav />
        <Hero />
        <SplitIntro />
        <WorkSection />
        <SolanaSection />
        <Footer />
      </main>
    </KaliBaitIntro>
  );
}

function StickyNav() {
  const navRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const shell = navRef.current;
    const brandPanel = shell?.querySelector<HTMLElement>("[data-nav-brand-panel]");
    const brandText = shell?.querySelector<HTMLElement>("[data-nav-brand-text]");
    const linksPanel = shell?.querySelector<HTMLElement>("[data-nav-links-panel]");
    if (!shell || !brandPanel || !brandText || !linksPanel) return;

    const createHeroExitTrigger = (timeline: gsap.core.Timeline) => {
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      let expanded = false;

      const shouldExpand = () => Boolean(hero && hero.getBoundingClientRect().bottom <= 0);
      const setExpanded = (next: boolean, immediate = false) => {
        if (!immediate && next === expanded) return;

        expanded = next;
        if (immediate) {
          timeline.progress(next ? 1 : 0).pause();
          return;
        }

        if (next) timeline.play();
        else timeline.reverse();
      };

      const trigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: () => setExpanded(shouldExpand()),
        onRefresh: () => setExpanded(shouldExpand(), true),
      });

      setExpanded(shouldExpand(), true);
      return () => {
        trigger.kill();
        timeline.kill();
      };
    };

    const createDesktopTimeline = () => {
      gsap.set(shell, { width: 380, height: 36 });
      gsap.set(brandPanel, { autoAlpha: 0, width: 380, height: 54 });
      gsap.set(brandText, { x: 0, xPercent: -50, y: 1.2 });
      gsap.set(linksPanel, { x: 0, y: 0, width: 380, height: 36 });

      return gsap
        .timeline({ paused: true })
        .to(shell, { height: 90, duration: 0.42, ease: "power3.out" }, 0)
        .to(linksPanel, { x: 0, y: 54, width: 380, duration: 0.42, ease: "power3.out" }, 0)
        .to(brandText, { y: 6, duration: 0.42, ease: "power3.out" }, 0)
        .to(brandPanel, { autoAlpha: 1, duration: 0.18, ease: "power1.out" }, 0.3);
    };

    const createMobileTimeline = () => {
      const shellWidth = window.innerWidth - 16;
      const compactWidth = shellWidth;
      const expandedWidth = shellWidth - 9;

      gsap.set(shell, { width: shellWidth, height: 36 });
      gsap.set(brandPanel, { autoAlpha: 0, width: shellWidth, height: 36 });
      gsap.set(brandText, { x: 0, xPercent: -50, y: 5 });
      gsap.set(linksPanel, { x: shellWidth - compactWidth, y: 0, width: compactWidth, height: 36 });

      return gsap
        .timeline({ paused: true })
        .to(shell, { height: 74, duration: 0.42, ease: "power3.out" }, 0)
        .to(linksPanel, { x: shellWidth - expandedWidth, y: 44, width: expandedWidth, duration: 0.42, ease: "power3.out" }, 0)
        .to(brandPanel, { autoAlpha: 1, duration: 0.18, ease: "power1.out" }, 0.3);
    };

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      return createHeroExitTrigger(createDesktopTimeline());
    });
    mm.add("(max-width: 767px)", () => {
      return createHeroExitTrigger(createMobileTimeline());
    });

    return () => mm.revert();
  }, []);

  return (
    <header
      ref={navRef}
      data-nav-shell
      className="fixed right-2 top-2 z-50 h-9 w-[calc(100vw-16px)] overflow-visible text-ink-near md:right-4 md:top-4 md:w-[380px]"
      aria-label="Primary navigation"
    >
      <div
        data-nav-brand-panel
        className="ceramic-panel absolute left-0 top-0 z-10 h-9 overflow-hidden rounded-[22px] opacity-0 md:h-[54px]"
      >
        <a
          data-nav-brand-text
          href="#top"
          className="absolute left-1/2 top-0 block leading-none"
        >
          <MiniKaliWordmark />
        </a>
      </div>
      <nav
        data-nav-links-panel
        className="absolute left-0 top-0 z-20 flex h-9 items-center justify-between gap-4 overflow-hidden rounded-pill border border-white/90 bg-cloud/90 px-5 text-[15px] font-medium leading-none shadow-[0_5px_0_rgba(107,137,93,0.28)] backdrop-blur"
      >
        <a data-nav-link href="#what" className="kali-link whitespace-nowrap">
          Product
        </a>
        <a data-nav-link href="#queries" className="kali-link whitespace-nowrap">
          Uses
        </a>
        <a data-nav-link href="#solana" className="kali-link whitespace-nowrap">
          Onchain
        </a>
        <a data-nav-link href="/chat" className="kali-link whitespace-nowrap">
          Open Kali
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      data-hero
      data-section-tone="dark-on-light"
      className="matcha-page relative flex min-h-screen w-full items-center justify-center overflow-hidden"
    >
      <SparkleField density={26} />
      <div aria-hidden className="absolute inset-0 mint-stripes opacity-80" />
      <ReceiptSticker
        label="Built for"
        value="Nonprofit teams"
        className="absolute left-4 top-4 z-20 max-w-[186px] rotate-[-3deg] text-[13px] font-medium leading-[1.15] md:left-5 md:top-5"
      >
        Two staff, eleven tools, never enough time.
      </ReceiptSticker>

      <ReceiptSticker
        label="Connects"
        value="11 tools"
        className="absolute right-4 top-[18%] z-20 hidden max-w-[200px] rotate-3 text-right md:block"
      >
        Salesforce, Drive, Gmail, Calendar, Slack, Notion, and more.
      </ReceiptSticker>

      <div data-hero-brand className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 leading-none opacity-70">
        <MiniKaliWordmark />
      </div>

      <div className="relative z-30 mx-auto flex w-full max-w-[860px] flex-col items-center justify-center px-4 text-center">
        <div className="hero-line">
          <KaliWordmark />
        </div>
        <div
          className="hero-line ceramic-panel mt-5 max-w-[760px] -rotate-1 rounded-[32px] px-6 py-5 text-[34px] font-medium leading-[1.02] text-ink-near md:mt-7 md:text-[56px] lg:text-[68px]"
          aria-hidden
        >
          <span className="block">One chat,</span>
          <span className="block text-matcha-700">every tool you run on.</span>
        </div>
        <p className="hero-line mt-6 max-w-[560px] font-subtext text-[16px] font-bold leading-[1.48] text-muted-deep md:text-[18px]">
          Kali is the agentic context layer for nonprofits. Ask anything across your CRM, drive, inbox, and calendar &mdash; get a single cited answer, with every write held until you approve it.
        </p>
        <div className="hero-line mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/chat"
            className="source-transition mochi-button inline-flex h-12 items-center justify-center bg-matcha-700 px-6 text-[16px] font-medium leading-none text-cloud hover:bg-matcha-500"
          >
            Try Kali
          </a>
          <a
            href="#queries"
            className="source-transition mochi-button inline-flex h-12 items-center justify-center bg-cloud px-6 text-[16px] font-medium leading-none text-matcha-700 ring-1 ring-matcha-700/20 hover:bg-matcha-100"
          >
            See uses
          </a>
        </div>
      </div>

      <ScatterSticker
        src="/kawaii/generated/hero-laptop-v2.png"
        alt=""
        className="hidden md:block right-[4%] bottom-[14%] h-[150px] w-[150px] rotate-6"
      />
      <ScatterSticker
        src="/kawaii/generated/hero-phone-v2.png"
        alt=""
        className="hidden md:block left-[4%] bottom-[14%] h-[140px] w-[140px] -rotate-6"
      />
      <ScatterSticker
        src="/kawaii/generated/hero-book-v2.png"
        alt=""
        className="hidden md:block left-[5%] top-[42%] h-[120px] w-[120px] rotate-[-8deg]"
      />
    </section>
  );
}

function ScatterSticker({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <div
      data-scatter-parallax
      data-parallax-y={HERO_DRIFT}
      className={`pointer-events-none absolute z-20 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 768px) 220px, 160px"
        className="object-contain drop-shadow-[0_8px_0_rgba(107,137,93,0.28)]"
        priority
      />
    </div>
  );
}

function SplitIntro() {
  return (
    <section
      id="what"
      data-section-tone="dark-on-light"
      className="relative min-h-[831px] overflow-hidden mint-gingham text-ink-near md:min-h-[751px]"
    >
      <SparkleField density={18} />
      <div className="pointer-events-none absolute right-[-40px] top-[70px] hidden h-[470px] w-[620px] rotate-3 md:block">
        <Image src="/kawaii/generated/intro-scene-v2.png" alt="" fill sizes="620px" className="object-contain drop-shadow-[0_10px_0_rgba(107,137,93,0.24)]" />
      </div>
      <div className="gutter relative z-10 flex min-h-[831px] flex-col justify-between py-[80px] md:min-h-[751px] md:py-[112px]">
        <div data-appear className="ceramic-panel max-w-[704px] rounded-[36px] p-7 font-subtext text-[24px] font-bold leading-[1.22] md:p-10 md:text-[32px]">
          <p>
            Nonprofits run lean. Two staff, eleven tools, donor data scattered across systems that were never built to talk.
          </p>
          <p className="mt-6 max-w-[563px] pl-[10%] text-matcha-700">
            Kali sits across all of them and answers in one place &mdash; with citations, with drafts, and with a clear approval step before anything is sent or saved.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <h2 data-appear className="font-bagel text-[38px] font-normal leading-[0.95] text-matcha-800 md:col-span-5 md:text-[60px]">
            Cute surface. Serious backend.
          </h2>
          <div data-appear data-appear-delay="0.08" className="md:col-span-3 md:col-start-10">
            <ul className="space-y-2 text-[22px] font-medium leading-[1.15] text-matcha-700 md:text-[28px]">
              <li>Cited answers</li>
              <li>Parallel tool calls</li>
              <li>Human-in-the-loop writes</li>
            </ul>
            <a
              href="#queries"
              className="source-transition mochi-button mt-5 inline-flex h-12 w-44 items-center justify-center bg-matcha-500 text-[16px] font-medium leading-none text-cloud hover:bg-matcha-700"
            >
              See uses
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkSection() {
  return (
    <section
      id="queries"
      data-selected-work
      data-section-tone="dark-on-light"
      className="relative h-[3487px] mint-stripes"
    >
      <div className="pointer-events-none sticky top-0 z-0 h-screen overflow-hidden">
        <div className="relative mx-auto h-full max-w-[1080px]">
          <h2
            data-selected-drift="left"
            className="text-sticker-matcha absolute left-0 top-[190px] font-bagel text-[72px] font-normal leading-[0.85] will-change-transform md:top-[214px] md:text-[200px]"
          >
            Uses
          </h2>
          <h2
            data-selected-drift="right"
            className="text-sticker-matcha absolute right-0 top-[350px] font-bagel text-[72px] font-normal leading-[0.85] will-change-transform md:top-[503px] md:text-[200px]"
          >
            today
          </h2>
          <div
            data-selected-drift="label"
            className="receipt-sticker absolute right-4 top-[245px] text-right text-[13px] font-medium leading-none will-change-transform md:right-[127px] md:top-[419px]"
          >
            What teams ask Kali
            <br />
            on day one
          </div>
        </div>
      </div>

      <div data-work-list className="gutter absolute inset-x-0 top-[1060px] z-10">
        <ul className="mx-auto flex max-w-[950px] flex-col gap-[160px] md:gap-[160px]">
          {WORK_ITEMS.map((item) => (
            <li key={item.title}>
              <a
                href="/chat"
                className="group grid gap-4 md:min-h-[629px] md:grid-cols-[244px_437px_244px] md:gap-3"
              >
                <div className="hidden items-end md:flex">
                  <h3 className="receipt-sticker rotate-[-2deg] text-[28px] font-medium leading-[1.05]">{toSentenceCase(item.title)}</h3>
                </div>
                <div
                  data-work-image={item.n}
                  className="source-media-tint relative aspect-[351/505] overflow-hidden bg-hairline md:h-[629px] md:w-[437px]"
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 768px) 437px, calc(100vw - 32px)"
                    className="object-cover source-transition group-hover:scale-[1.02]"
                  />
                </div>
                <div className="receipt-sticker hidden rotate-2 space-y-3 text-[14px] font-medium leading-[1.45] text-muted-secondary md:block">
                  <p className="text-[15px] leading-[1.4] text-ink-near">{item.blurb}</p>
                  <div className="space-y-1 text-[13px] uppercase tracking-[0.12em] text-matcha-700">
                    <p>{item.tags[0]}</p>
                    <p>{item.tags[1]}</p>
                  </div>
                  <p className="text-ink-near/35">({item.n})</p>
                </div>
                <span className="sr-only">
                  {item.title}, {item.tags.join(" and ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const SOLANA_PILLARS = [
  {
    title: "x402 agent payments",
    blurb:
      "Every nonprofit gets a public HTTP 402 endpoint. Any AI agent can pay USDC over the wire — real onchain settlement on Solana, with tax-deductible receipts auto-issued for human-attributed gifts.",
    tag: "USDC · HTTP 402 · Privy delegation",
    src: "/kawaii/generated/solana-x402-v2.png",
    alt: "kawaii sticker scene of the kali matcha mascot handing a USDC coin sticker to a tiny robot agent",
  },
  {
    title: "Cause coins",
    blurb:
      "Launch a tokenized version of your cause on Solana. Supporters trade, hold, and govern — bonding curves seed liquidity, and a portion of fees streams back to the nonprofit's treasury.",
    tag: "SPL · bonding curve · governance",
    src: "/kawaii/generated/solana-coins-v2.png",
    alt: "kawaii sticker scene of the kali matcha mascot holding up a heart-marked cause-coin token with a bonding curve graph",
  },
  {
    title: "Onchain receipts",
    blurb:
      "Every donation, every approval, every agent call gets a verifiable receipt — a permanent, citable record your board, your auditors, and your donors can all read.",
    tag: "Devnet · Solana Pay · transparency",
    src: "/kawaii/generated/solana-receipts-v2.png",
    alt: "kawaii sticker scene of the kali matcha mascot holding a long ribbon receipt with a chain-link onchain provenance icon",
  },
];

function SolanaSection() {
  return (
    <section
      id="solana"
      data-section-tone="dark-on-light"
      className="matcha-page relative overflow-hidden"
    >
      <SparkleField density={20} />
      <div className="gutter relative z-10 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-5">
            <p
              data-appear
              className="font-mono text-[12px] uppercase tracking-[0.18em] text-matcha-700"
            >
              Built on Solana
            </p>
            <h2
              data-appear
              data-appear-delay="0.05"
              className="mt-4 font-bagel text-[44px] font-normal leading-[0.98] text-matcha-800 md:text-[68px]"
            >
              Cute on top.
              <br />
              Onchain underneath.
            </h2>
            <p
              data-appear
              data-appear-delay="0.1"
              className="mt-6 max-w-[440px] font-subtext text-[16px] font-bold leading-[1.5] text-muted-deep md:text-[17px]"
            >
              Kali ships with Solana-native rails so nonprofits can accept agent
              payments, launch cause coins, and prove every dollar with a
              receipt anyone can verify.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/crypto"
                className="source-transition mochi-button inline-flex h-12 items-center justify-center bg-matcha-700 px-6 text-[15px] font-medium leading-none text-cloud hover:bg-matcha-500"
              >
                See the onchain stack
              </a>
              <a
                href="/pay/rivertown"
                className="source-transition mochi-button inline-flex h-12 items-center justify-center bg-cloud px-6 text-[15px] font-medium leading-none text-matcha-700 ring-1 ring-matcha-700/20 hover:bg-matcha-100"
              >
                Demo x402 endpoint
              </a>
            </div>
          </div>

          <ul className="space-y-5 md:col-span-7">
            {SOLANA_PILLARS.map((pillar, i) => (
              <li
                key={pillar.title}
                data-appear
                data-appear-delay={(0.05 * (i + 1)).toFixed(2)}
                className="ceramic-panel flex items-start gap-5 rounded-[28px] p-5 md:gap-6 md:p-7"
              >
                <div className="relative h-[88px] w-[88px] shrink-0 md:h-[112px] md:w-[112px]">
                  <Image
                    src={pillar.src}
                    alt={pillar.alt}
                    fill
                    sizes="(min-width: 768px) 112px, 88px"
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-bagel text-[22px] font-normal leading-[1.05] text-matcha-800 md:text-[26px]">
                      {pillar.title}
                    </h3>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-matcha-700">
                      {pillar.tag}
                    </span>
                  </div>
                  <p className="mt-3 font-subtext text-[15px] font-medium leading-[1.5] text-muted-deep md:text-[16px]">
                    {pillar.blurb}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer data-section-tone="dark-on-light" className="relative isolate overflow-hidden bg-[var(--paper)] text-ink-near">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "url(/kawaii/generated/footer-leaves-v1.png)",
          backgroundRepeat: "repeat",
          backgroundSize: "640px auto",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-[var(--paper)]/55" />
      <SparkleField density={30} />
      <div className="gutter relative z-10 py-16 md:py-20">
        <div className="grid gap-10 text-[15px] font-medium leading-[1.5] md:grid-cols-12 md:gap-12">
          <div className="ceramic-panel max-w-[460px] rounded-[28px] p-6 md:col-span-5 md:p-7">
            <p className="text-[18px] leading-[1.45] text-ink-near md:text-[20px]">
              Kali is the agentic context layer for nonprofits. Cited answers across every tool you run on, with human approval before anything writes back.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:col-span-7">
            <div>
              <div className="ceramic-panel h-full rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-secondary">Status</p>
                <p className="mt-2">Private beta</p>
                <p className="text-muted-secondary">Onboarding nonprofits now</p>
              </div>
            </div>
            <div>
              <div className="ceramic-panel h-full rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-secondary">Reach the team</p>
                <a href="mailto:founders@kalilabs.ai" className="kali-link mt-2 block break-words">
                  founders@kalilabs.ai
                </a>
                <a href="https://github.com/stephenhungg/kali-v0" className="kali-link block break-words text-muted-secondary">
                  github.com/stephenhungg/kali-v0
                </a>
              </div>
            </div>
            <div>
              <div className="ceramic-panel h-full rounded-[24px] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-secondary">Built at</p>
                <p className="mt-2">HackDavis 2026</p>
                <p className="text-muted-secondary">UC Davis &middot; May 10</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="gutter relative z-10 flex flex-col items-center gap-3 border-t border-hairline pb-8 pt-8 text-[12px] text-muted-secondary md:flex-row md:justify-between">
        <p>&copy; 2026 Kali Labs &middot; Made with matcha at UC Davis</p>
        <div className="flex items-center gap-4">
          <a href="#top" className="kali-link">Back to top</a>
          <a href="mailto:founders@kalilabs.ai" className="kali-link">Email</a>
        </div>
      </div>
    </footer>
  );
}

function toSentenceCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
