/**
 * POST /api/onboarding/complete
 *
 * Finalizes the wizard: stamps `onboardedAt`, returns the redirect target.
 * After this, /chat and /dashboard unlock.
 */

import { NextResponse } from "next/server";
import { getOnboardingState, patchOnboardingState } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId, state } = await getOnboardingState();
    if (!userId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }
    if (!state?.tenant?.name) {
      return NextResponse.json({ error: "tenant profile incomplete" }, { status: 400 });
    }
    await patchOnboardingState({
      currentStep: 6,
      onboardedAt: new Date().toISOString(),
    });
    return NextResponse.json({ redirectTo: "/dashboard" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "internal" }, { status: 500 });
  }
}
