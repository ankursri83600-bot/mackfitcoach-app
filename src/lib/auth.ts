import "server-only";

import { redirect } from "next/navigation";

import { getProfile, type Profile } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Redirects to login unless signed in. Returns the profile. */
export async function requireUser(next = "/dashboard"): Promise<Profile> {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const profile = await getProfile();
  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return profile;
}

const STAFF_ROLES = ["admin", "dietician", "trainer"] as const;

/** Staff = admin, dietician or trainer. Redirects, never returns false. */
export async function requireStaff(): Promise<Profile> {
  const profile = await requireUser("/admin");
  if (!STAFF_ROLES.includes(profile.role as (typeof STAFF_ROLES)[number])) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser("/admin");
  if (profile.role !== "admin") {
    redirect("/admin");
  }
  return profile;
}

export function isStaffRole(role: string | undefined | null) {
  return Boolean(role && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
}

/**
 * Gate for the admin console.
 *
 * When Supabase is configured this is a HARD gate — identical to requireStaff(),
 * redirecting anyone who is not staff. When it is NOT configured there is no
 * database, therefore no real customer data in existence to protect, so the
 * console renders with clearly-labelled sample rows instead of bouncing the
 * visitor to a login page that cannot work. That is the only case where the
 * check is relaxed, and the relaxation disappears the moment keys are added.
 */
export async function requireStaffOrDemo(): Promise<{
  profile: Profile | null;
  demo: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { profile: null, demo: true };
  }
  const profile = await requireStaff();
  return { profile, demo: false };
}
