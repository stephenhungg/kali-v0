/**
 * POST /api/onboarding/upload
 *
 * Receives a File via multipart FormData, IGNORES its content (this is
 * theater), echoes back a deterministic-by-filename FakeIngestStats, and
 * appends a record to user_metadata.onboarding.uploads[].
 */

import { NextResponse } from "next/server";
import { getOnboardingState, patchOnboardingState } from "../../../../lib/supabase/server";
import { fakeIngestStats } from "../../../../lib/onboarding/fake-ingestion";
import type { UploadRecord } from "../../../../lib/supabase/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId, state } = await getOnboardingState();
    if (!userId) {
      return NextResponse.json({ error: "no session" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const stats = fakeIngestStats({ name: file.name, size: file.size, type: file.type });
    const record: UploadRecord = {
      id: `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      recordsExtracted: stats.recordsExtracted,
      entitiesResolved: stats.entitiesResolved,
      durationMs: stats.durationMs,
      uploadedAt: new Date().toISOString(),
    };

    const uploads = [...(state?.uploads ?? []), record];
    await patchOnboardingState({ uploads });

    return NextResponse.json({ record, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "internal" }, { status: 500 });
  }
}
