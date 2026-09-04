import "server-only";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import type { StoredPlan } from "@/lib/diet/storage";

/** Cookie holding the guest claim token for plans generated before signing up. */
export const CLAIM_COOKIE = "mfc_claim";

export type AccessLevel = "preview" | "full";

export interface PlanAccess {
  level: AccessLevel;
  /** Can this caller see the plan at all? */
  canView: boolean;
  reason: "owner" | "claim_token" | "entitled" | "staff" | "denied";
}

/**
 * Decides what a caller may see of a given plan.
 *
 * Two separate questions, deliberately kept apart:
 *   1. May they view this plan at all? Owner, matching guest claim token, or staff.
 *   2. May they see days 2-7? Only with a live `full_plan` entitlement, or staff.
 *
 * Called from the plan page, the print route and the PDF route, so there is one
 * place where the paywall is decided rather than three that can drift.
 */
export async function getPlanAccess(stored: StoredPlan): Promise<PlanAccess> {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const claim = cookieStore.get(CLAIM_COOKIE)?.value ?? null;

  const isOwner = Boolean(user && stored.userId && user.id === stored.userId);
  const hasClaim = Boolean(
    stored.claimToken && claim && stored.claimToken === claim,
  );

  // Without Supabase there is nothing to check against, so the plan is viewable
  // and the paywall is exercised through the demo unlock instead.
  const admin = createAdminClient();
  if (!admin) {
    return { level: "preview", canView: true, reason: "claim_token" };
  }

  if (user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && ["admin", "dietician", "trainer"].includes(profile.role as string)) {
      return { level: "full", canView: true, reason: "staff" };
    }
  }

  if (!isOwner && !hasClaim) {
    return { level: "preview", canView: false, reason: "denied" };
  }

  if (user) {
    const { data } = await admin
      .from("entitlements")
      .select("id, expires_at, revoked_at, diet_request_id")
      .eq("user_id", user.id)
      .eq("scope", "full_plan")
      .is("revoked_at", null);

    const now = Date.now();
    const entitled = (data ?? []).some((row) => {
      const notExpired = !row.expires_at || new Date(row.expires_at).getTime() > now;
      const scoped =
        !row.diet_request_id || row.diet_request_id === stored.requestId;
      return notExpired && scoped;
    });

    if (entitled) return { level: "full", canView: true, reason: "entitled" };
  }

  return {
    level: "preview",
    canView: true,
    reason: isOwner ? "owner" : "claim_token",
  };
}

/**
 * Demo unlock for local use without payment credentials.
 *
 * Deliberately a URL search param rather than anything persisted, so it can
 * never be confused for real access control. Ignored entirely once Razorpay is
 * configured — see `resolveAccess`.
 */
export function hasDemoUnlock(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return searchParams.unlocked === "1";
}

/**
 * The single answer used by every plan surface.
 *
 * When payments are live the demo flag is ignored; only a real entitlement (or
 * staff) unlocks the full week.
 */
export async function resolveAccess(
  stored: StoredPlan,
  searchParams: Record<string, string | string[] | undefined>,
  paymentsLive: boolean,
): Promise<PlanAccess> {
  const access = await getPlanAccess(stored);
  if (access.level === "full" || !access.canView) return access;
  if (!paymentsLive && hasDemoUnlock(searchParams)) {
    return { ...access, level: "full" };
  }
  return access;
}
