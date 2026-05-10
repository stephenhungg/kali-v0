/**
 * Subdomain rewriter for the public payment + cause-coin surfaces.
 *
 *   pay.kalilabs.ai/<slug>           → app/_pay/[slug]/page.tsx
 *   pay.kalilabs.ai/<slug>/recurring → app/_pay/[slug]/recurring/page.tsx
 *   pay.kalilabs.ai/.well-known/x402-directory.json
 *                                    → app/_pay/.well-known/x402-directory.json/route.ts
 *
 *   coin.kalilabs.ai/<slug>          → app/_coin/[slug]/page.tsx
 *   coin.kalilabs.ai/directory       → app/_coin/directory/page.tsx
 *   coin.kalilabs.ai/<slug>/governance, /me, etc.
 *
 * In dev, add to /etc/hosts:
 *   127.0.0.1 pay.kalilabs.ai coin.kalilabs.ai
 * and run:
 *   next dev --hostname 0.0.0.0
 *
 * Requests on the main host (kalilabs.ai or localhost) pass through unchanged.
 */

import { NextResponse, type NextRequest } from "next/server";

const PAY_HOST = process.env.KALI_PAY_HOST ?? "pay.kalilabs.ai";
const COIN_HOST = process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai";

function stripPort(host: string | null): string {
  if (!host) return "";
  const i = host.indexOf(":");
  return i === -1 ? host : host.slice(0, i);
}

export function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get("host"));
  const url = req.nextUrl.clone();

  // Internal Next.js paths + APIs always pass through.
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (host === PAY_HOST || host === `dev.${PAY_HOST}`) {
    if (url.pathname.startsWith("/_pay")) {
      // Already rewritten — short-circuit to avoid double-rewrite.
      return NextResponse.next();
    }
    url.pathname = `/_pay${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === COIN_HOST || host === `dev.${COIN_HOST}`) {
    if (url.pathname.startsWith("/_coin")) {
      return NextResponse.next();
    }
    url.pathname = `/_coin${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip everything we don't want to rewrite. The negative lookahead lets
  // /_next/, /api/, and static assets through without invoking middleware.
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
