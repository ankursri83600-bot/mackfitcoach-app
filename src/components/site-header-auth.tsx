import Link from "next/link";

import { getProfile } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/auth";

/**
 * Auth-aware corner of the header.
 *
 * A server component so the session is read on the server and no auth state has
 * to be hydrated into the client bundle.
 */
export async function SiteHeaderAuth() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <Link
        href="/login"
        className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-bone/80 transition-colors hover:text-bone"
      >
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {isStaffRole(profile.role) ? (
        <Link
          href="/admin"
          className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-blood-bright transition-opacity hover:opacity-80"
        >
          Admin
        </Link>
      ) : null}
      <Link
        href="/dashboard"
        className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-bone/80 transition-colors hover:text-bone"
      >
        {profile.full_name ? profile.full_name.split(" ")[0] : "Account"}
      </Link>
    </div>
  );
}
