import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service_role key (bypasses RLS).
 * NEVER import this file from client components or files with "use client".
 * Use only inside app/api/** route handlers and lib/db/**.
 */
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Without this, the old anon-key fallback made every query silently
    // return empty results under RLS instead of failing loudly.
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });
}
