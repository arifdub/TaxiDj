"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only the public URL + anon key are used in the browser. All access control
// is enforced by Row Level Security and SECURITY DEFINER functions in
// Postgres, so no service-role key is ever needed by the app.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Returns the shared browser client, or null when env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "taxidj-auth",
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/** Like getSupabase() but throws — for code paths guarded by <SupabaseGate>. */
export function supabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("SUPABASE_NOT_CONFIGURED");
  return c;
}
