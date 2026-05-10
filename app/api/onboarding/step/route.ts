/**
 * GET  /api/onboarding/step  — returns current OnboardingState for the session
 * POST /api/onboarding/step  — patches state (current step + step-specific fields)
 *
 * State lives on `auth.users.user_metadata.onboarding`. Per-request cookie
 * is the source of truth for "who is this." Patches use the admin client so
 * they succeed regardless of session refresh state.
 */

import { NextResponse } from "next/server";
import { getOnboardingState, patchOnboardingState } from "../../../../lib/supabase/server";
import type { OnboardingState } from "../../../../lib/supabase/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId, email, state } = await getOnboardingState();
    if (!userId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }
    return NextResponse.json({ userId, email, state });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "internal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getOnboardingState();
    if (!userId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }
    const patch = (await req.json()) as Partial<OnboardingState>;
    if (typeof patch !== "object" || patch === null) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const merged = await patchOnboardingState(patch);
    return NextResponse.json({ state: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "internal" }, { status: 500 });
  }
}
