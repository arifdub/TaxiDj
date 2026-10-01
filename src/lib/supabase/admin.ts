import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client with the service-role key (bypasses RLS).
// Used only by trusted server routes, e.g. sending push notifications.
// SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser.

let admin: SupabaseClient | null = null;

export function isAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin(): SupabaseClient {
  if (!isAdminConfigured()) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** The user behind a Supabase access token (from the Authorization header). */
export async function userFromRequest(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}
