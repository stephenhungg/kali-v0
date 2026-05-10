/**
 * Recurring subscription setup page. Walks the donor through:
 *
 *   1. Pick amount + period
 *   2. Connect Privy embedded wallet
 *   3. Sign delegation proof (scope=donate, expires in 1y)
 *   4. POST to /api/x402/<slug>/recurring — first charge fires immediately
 *   5. Show receipt + next-charge timestamp
 *
 * Privy SDK integration is loaded lazily so this page renders SSR even
 * when Privy creds aren't configured (the form falls back to a "demo"
 * mode that posts a stub delegation proof so the dev demo still works).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenants";
import { RecurringForm } from "./RecurringForm";

export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RecurringPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      <section className="mx-auto max-w-[760px] px-6 pt-16 pb-24 sm:px-12">
        <Link
          href={`/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60 hover:opacity-100"
        >
          ← back to {tenant.name}
        </Link>

        <h1 className="r-display mt-8 text-5xl font-medium leading-[1] tracking-tight md:text-6xl">
          Set up recurring{" "}
          <span className="r-italic font-light text-[var(--strawberry-deep)]">
            giving
          </span>
        </h1>

        <p className="mt-6 max-w-[500px] text-sm opacity-80">
          One signature now. We'll use your Privy delegation to autonomously charge USDC on the
          schedule you pick — no future approvals, sub-cent fees, cancel any time. Tax receipts
          are auto-issued because the delegation proof binds the wallet to your verified
          identity.
        </p>

        <RecurringForm tenantSlug={slug} programs={tenant.programs} />
      </section>
    </main>
  );
}
