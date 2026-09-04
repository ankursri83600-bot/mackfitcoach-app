import "server-only";

import { COACHES as STATIC_COACHES, type Coach } from "@/lib/data/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicStorageUrl } from "@/lib/supabase/config";

export interface CoachRecord extends Coach {
  id: string | null;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
  timezone: string;
}

const FALLBACK_DEFAULTS = {
  id: null,
  slotMinutes: 30,
  leadTimeMinutes: 120,
  maxDaysAhead: 30,
  timezone: "Asia/Kolkata",
};

/**
 * Coaches from Supabase, falling back to the static list.
 *
 * The fallback is what lets /coaches and /book render a believable page with no
 * database at all; booking itself is disabled in that mode because there is
 * nowhere to record it.
 */
export async function listCoaches(): Promise<CoachRecord[]> {
  const admin = createAdminClient();
  if (!admin) {
    return STATIC_COACHES.map((c) => ({ ...c, ...FALLBACK_DEFAULTS }));
  }

  const { data, error } = await admin
    .from("coaches")
    .select(
      "id, slug, name, kind, headline, bio, specialties, photo_path, slot_minutes, lead_time_minutes, max_days_ahead, timezone",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    return STATIC_COACHES.map((c) => ({ ...c, ...FALLBACK_DEFAULTS }));
  }

  return data.map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    kind: row.kind as Coach["kind"],
    headline: (row.headline as string) ?? "",
    bio: (row.bio as string) ?? "",
    specialties: (row.specialties as string[]) ?? [],
    experienceYears: 0,
    // Storage first; otherwise the bundled portrait for this slug. The old
    // fallback was Mack's photo for EVERY coach, so the dietician and the
    // trainer both showed his face until a photo_path was set.
    photoSrc: row.photo_path
      ? publicStorageUrl("coach-photos", row.photo_path as string)
      : bundledPortrait(row.slug as string),
    id: row.id as string,
    slotMinutes: (row.slot_minutes as number) ?? 30,
    leadTimeMinutes: (row.lead_time_minutes as number) ?? 120,
    maxDaysAhead: (row.max_days_ahead as number) ?? 30,
    timezone: (row.timezone as string) ?? "Asia/Kolkata",
  }));
}

/**
 * Portraits that ship with the app, keyed by slug. A coach whose slug has no
 * bundled file falls back to the founder's photo rather than a broken image;
 * upload to the `coach-photos` bucket and set `photo_path` to override.
 */
const BUNDLED_PORTRAITS: Record<string, string> = {
  mack: "/coach/coach-mack.jpg",
  dietician: "/coach/coach-dietician.jpg",
  trainer: "/coach/coach-trainer.jpg",
};

function bundledPortrait(slug: string): string {
  return BUNDLED_PORTRAITS[slug] ?? "/coach/coach-mack.jpg";
}

export async function getCoachBySlug(slug: string): Promise<CoachRecord | null> {
  const coaches = await listCoaches();
  return coaches.find((c) => c.slug === slug) ?? null;
}
