import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key. This bypasses
 * Row Level Security entirely, so it must never be imported into client
 * components or exposed to the browser. All access control (owner vs
 * client, partial vs full profile data) is enforced in application code.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
