import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { hasServiceRoleKey, isSupabaseConfigured, supabaseUrl } from "./config";

/**
 * Service-role client. BYPASSES RLS — every use must be preceded by an explicit
 * authorisation check in application code.
 *
 * `server-only` makes importing this from a Client Component a build error, so
 * the key cannot reach the browser bundle by accident.
 */
export function createAdminClient() {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) return null;

  return createSupabaseClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { hasServiceRoleKey };
