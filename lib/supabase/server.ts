/**
 * Server-side Supabase clients.
 *
 * Two flavors:
 *   getSupabaseServerClient() — request-scoped, cookie-aware. Use from
 *     route handlers + server components to read the logged-in session.
 *   getSupabaseAdminClient() — service-role, NO COOKIES, full DB powers.
 *     Use from /api/onboarding/* to write user_metadata regardless of who
 *     is calling. Never expose to the browser.
 *
 * Both are created fresh per call (Next 16 server APIs are per-request anyway).
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { OnboardingState } from "./types";

export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Setting cookies in a Server Component throws — caller is read-only.
          // The middleware writes session cookies on every refresh; safe to ignore.
        }
      },
    },
  });
}

let _admin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error(
      "Supabase admin env missing: set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

/** Read the current session's onboarding state from user_metadata. */
export async function getOnboardingState(): Promise<{
  userId: string | null;
  email: string | null;
  state: OnboardingState | null;
}> {
  const supa = await getSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { userId: null, email: null, state: null };
  const meta = (user.user_metadata ?? {}) as { onboarding?: OnboardingState };
  return { userId: user.id, email: user.email ?? null, state: meta.onboarding ?? null };
}

/**
 * Merge a partial OnboardingState onto the *current session's* user metadata.
 *
 * Uses the cookie-scoped session client + `auth.updateUser`, which a logged-in
 * user is allowed to call against their own row. NO service-role key needed —
 * the public anon key is enough for self-service onboarding writes.
 */
export async function patchOnboardingState(
  patch: Partial<OnboardingState>,
): Promise<OnboardingState> {
  const supa = await getSupabaseServerClient();
  const { data: { user }, error: getErr } = await supa.auth.getUser();
  if (getErr) throw new Error(`getUser: ${getErr.message}`);
  if (!user) throw new Error("not authenticated");

  const existing =
    ((user.user_metadata ?? {}) as { onboarding?: OnboardingState }).onboarding ??
    { currentStep: 1 };
  const merged: OnboardingState = {
    ...existing,
    ...patch,
    tenant: patch.tenant ? { ...existing.tenant, ...patch.tenant } : existing.tenant,
    selectedConnectors: patch.selectedConnectors ?? existing.selectedConnectors,
    connectedConnectors: patch.connectedConnectors ?? existing.connectedConnectors,
    uploads: patch.uploads ?? existing.uploads,
  };
  const { error: updErr } = await supa.auth.updateUser({
    data: { ...(user.user_metadata ?? {}), onboarding: merged },
  });
  if (updErr) throw new Error(`updateUser: ${updErr.message}`);
  return merged;
}
