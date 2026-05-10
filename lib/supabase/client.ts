"use client";

/**
 * Browser-side Supabase client. Used from "use client" components for
 * `auth.signUp` / `auth.signInWithPassword` / `auth.signOut`. Reads
 * cookies via the standard @supabase/ssr browser adapter.
 *
 * Singleton — created on first import.
 */

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  _client = createBrowserClient(url, anon);
  return _client;
}
