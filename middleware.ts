/**
 * Middleware — does three jobs:
 *
 * 1. Subdomain rewriter:
 *    pay.kalilabs.ai/<slug>           → app/pay/[slug]/page.tsx
 *    coin.kalilabs.ai/<slug>          → app/coin/[slug]/page.tsx
 *
 * 2. Demo bypass cookie:
 *    Hitting any URL with `?demo=rivertown` sets `kali_demo_mode=rivertown`
 *    and redirects to the same path WITHOUT the query, so the cookie is in
 *    the next request. This is what makes /dashboard?demo=rivertown work
 *    on the FIRST follow-up render (Set-Cookie isn't visible in the same
 *    request that sets it).
 *
 * 3. Auth gate for /chat + /dashboard:
 *    no Supabase session       → redirect to /onboarding
 *    session but no onboardedAt → redirect to /onboarding (resume mid-flow)
 *    onboarded OR demo cookie  → pass through
 *    Supabase not configured at all → pass through (dev fallback)
 *
 * In dev, add to /etc/hosts: 127.0.0.1 pay.kalilabs.ai coin.kalilabs.ai
 */

import { NextResponse, type NextRequest } from "next/server";

const PAY_HOST = process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai";
const COIN_HOST = process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai";
const DEMO_COOKIE = "kali_demo_mode";
const GATED_PREFIXES = ["/chat", "/dashboard"];

function stripPort(host: string | null): string {
  if (!host) return "";
  const i = host.indexOf(":");
  return i === -1 ? host : host.slice(0, i);
}

export async function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get("host"));
  const url = req.nextUrl.clone();

  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ─── 1. Subdomain rewrites ───────────────────────────────────────
  if (host === PAY_HOST || host === `dev.${PAY_HOST}`) {
    if (url.pathname.startsWith("/pay")) return NextResponse.next();
    url.pathname = `/pay${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  if (host === COIN_HOST || host === `dev.${COIN_HOST}`) {
    if (url.pathname.startsWith("/coin")) return NextResponse.next();
    url.pathname = `/coin${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── 2. Demo bypass: ?demo=rivertown sets cookie + REDIRECTS ─────
  // Redirecting (instead of next()) is what makes the cookie show up in
  // the follow-up request. Without this, layouts like /chat/layout.tsx
  // can't see the cookie on the same hop and the auth gate fires.
  const demoParam = url.searchParams.get("demo");
  if (demoParam === "rivertown") {
    const cleanUrl = url.clone();
    cleanUrl.searchParams.delete("demo");
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(DEMO_COOKIE, "rivertown", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return res;
  }

  const hasDemoCookie = req.cookies.get(DEMO_COOKIE)?.value === "rivertown";

  // ─── 3. Auth gate for /chat + /dashboard ────────────────────────
  const needsGate = GATED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (!needsGate) return NextResponse.next();
  if (hasDemoCookie) return NextResponse.next();

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaAnon) {
    // Supabase not configured → dev fallback, let it through.
    return NextResponse.next();
  }

  // Defer Supabase server-client construction so this module stays cheap
  // when the env vars aren't present (most dev sessions).
  const { createServerClient } = await import("@supabase/ssr");
  const res = NextResponse.next();
  const supa = createServerClient(supaUrl, supaAnon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    const onboard = url.clone();
    onboard.pathname = "/onboarding";
    onboard.search = "";
    return NextResponse.redirect(onboard);
  }
  const onboarding = (user.user_metadata ?? {}).onboarding as
    | { onboardedAt?: string; currentStep?: number }
    | undefined;
  if (!onboarding?.onboardedAt) {
    const onboard = url.clone();
    onboard.pathname = "/onboarding";
    onboard.search = onboarding?.currentStep ? `?step=${onboarding.currentStep}` : "";
    return NextResponse.redirect(onboard);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
