# scroll-fx

reusable gsap-based scroll effects for kali-v0. ported from a curated set of
codrops/codepen demos. consumer styles content; this library only handles
motion + scroll wiring.

## install / setup

gsap + @gsap/react are already in the repo deps. lenis is the only addition.

mount the provider once at the layout level:

```tsx
// app/layout.tsx
import { SmoothScrollProvider } from "@/lib/scroll-fx";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
```

`SmoothScrollProvider` is required for any of these effects to feel right —
it boots lenis, syncs gsap.ticker, and wires `[data-speed]` parallax.

## effects

every component is `'use client'`, ssr-safe, and styles only structurally —
your tailwind/css drives the visual.

### `<AutoSplitText>` — text reveal, word-by-word

ported from: `autosplit-with-scrolltrigger`

```tsx
import { AutoSplitText } from "@/lib/scroll-fx";

<AutoSplitText as="h1" split="words" stagger={0.05} className="text-6xl">
  ask kali. across everything. in english.
</AutoSplitText>
```

caveat: uses a vanilla word/char splitter (not gsap premium splittext).

### `<RevealOnScrollDirection>` — direction-aware reveal

ported from: `reveal-animations-based-on-scroll-direction`

```tsx
<RevealOnScrollDirection from="down" distance={60}>
  <Card />
</RevealOnScrollDirection>
```

reveals from below when scrolling down, from above when scrolling up.

### `<HorizontalGallery>` — pinned horizontal scroll

ported from: `horizontal-scrolling-gallery`

```tsx
<HorizontalGallery trackClassName="flex gap-8">
  <Slide /><Slide /><Slide />
</HorizontalGallery>
```

caveat: pins the section while scrolling; budget vertical space accordingly
via the `end` prop (default `'+=300%'`).

### `<ScrollToViewGallery>` — items cascade in as they enter view

ported from: `scroll-to-view-gallery`

```tsx
<ScrollToViewGallery>
  <Card data-item /><Card data-item /><Card data-item />
</ScrollToViewGallery>
```

each child needs `data-item` (or pass a custom `itemSelector`).

### `<ScrubbedBentoGallery>` — flip-based bento expansion

ported from: `scrubbed-bento-gallery`

```tsx
<ScrubbedBentoGallery>
  <div data-bento-grid className="...initial-bento...">
    <div data-bento>...</div>
    <div data-bento>...</div>
  </div>
</ScrubbedBentoGallery>
```

caveat: consumer styles two layout states via `[data-bento-grid]` and
`[data-bento-grid].is-final`. uses gsap flip plugin.

### `<ImageZoom>` — pinned scroll-driven scale

ported from: `scrolltrigger-image-zoom`

```tsx
<ImageZoom src="/hero.jpg" alt="kali product hero" fromScale={0.6} toScale={1.2} />
```

### `<Parallax>` — simple translateY parallax

ported from: `simple-parallax-effect`

```tsx
<Parallax speed={0.5} distance={120}>
  <BackgroundImage />
</Parallax>
```

speed semantics: `0` = no movement, `1` = scrolls with page, negative =
moves opposite direction.

alternative: drop `data-speed="0.7"` directly on any element and
`SmoothScrollProvider` will wire parallax automatically — no component needed
for the simplest cases.

### `<RevealSection>` — observer-driven full-screen sections

ported from: `animated-continuous-sections-with-gsap-observer`

```tsx
<RevealSection
  sections={[<Hero />, <Features />, <Pricing />]}
  animation="cover"
/>
```

caveat: this scroll-jacks the page (wheel/touch advances one section at a
time). use sparingly — great for marketing hero stacks, terrible for
content-heavy pages.

### `<FooterBounce>` — velocity-based squish

ported from: `footer-bounce-based-on-scroll-speed`

```tsx
<FooterBounce intensity={1}>
  <Footer />
</FooterBounce>
```

scales the wrapped content based on `ScrollTrigger.getVelocity()`.

## utilities

- `splitText(el, mode)` — vanilla word/char splitter, returns `{ units, cleanup }`. used internally by `AutoSplitText`. exposed for custom text effects.
- `useScrollTrigger()` — hook that registers the ScrollTrigger plugin once. components in this library already call it; you only need it if you're writing your own ScrollTrigger code.

## premium plugin notes

avoided on purpose:

- **SplitText** → replaced with `util/splitText.ts` (words/chars only, no lines).
- **ScrollSmoother** → replaced with `lenis` in `SmoothScrollProvider`. `data-speed` parallax is supported; `data-lag` is not.

if kali ever buys gsap club greensock, drop-in upgrades are possible — the api surface of these components shouldn't change.

## sources

every effect cites its source demo at the top of its file. originals at
`~/.tenzin/runtime/.claude/claudeclaw/inbox/discord/zips/`.
