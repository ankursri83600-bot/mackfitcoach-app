/**
 * Is Supabase actually configured, or are we running on placeholders?
 *
 * The whole site is built to work with no credentials at all, so every
 * Supabase-touching path checks this first and falls back to a clearly-labelled
 * local mode rather than throwing. The heuristic matches the placeholder values
 * shipped in .env.local.example.
 */
import { isRealSecret, looksLikePlaceholder } from "@/lib/env-guard";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;
  if (looksLikePlaceholder(url)) return false;
  if (!isRealSecret(key, 20)) return false;

  try {
    new URL(url);
  } catch {
    return false;
  }
  return true;
}

/**
 * Service-role key present? Required for any privileged server write.
 *
 * A placeholder here is particularly nasty: it produces a client that looks
 * usable but 401s on every query, so features fail at runtime instead of
 * degrading to the offline path.
 */
export function hasServiceRoleKey(): boolean {
  return isRealSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, 20);
}

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** Public URL for an object in a public bucket. */
export function publicStorageUrl(bucket: string, path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${bucket}/${path}`;
}
