import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

/**
 * Request-scoped client that respects RLS as the signed-in user.
 *
 * In Next 16 `cookies()` is always async — the sync compatibility shim from 15
 * is gone, not merely deprecated.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // src/proxy.ts refreshes the session instead, so this is safe to swallow.
        }
      },
    },
  });
}

/** The signed-in user, or null. Never throws when Supabase is unconfigured. */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "user" | "dietician" | "trainer" | "admin";
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}
