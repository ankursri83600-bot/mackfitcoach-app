import { NextResponse, type NextRequest } from "next/server";

import { claimGuestPlan } from "@/lib/diet/storage";
import { CLAIM_COOKIE } from "@/lib/entitlements";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Attaches a guest-generated plan to the account that just signed up.
 *
 * Called right after a sign-up that returns a session immediately (i.e. email
 * confirmation disabled); the /auth/callback route covers the confirmed-email
 * path.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const claim = request.cookies.get(CLAIM_COOKIE)?.value;
  if (!claim) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  await claimGuestPlan(user.id, claim);

  const response = NextResponse.json({ ok: true, claimed: true });
  response.cookies.delete(CLAIM_COOKIE);
  return response;
}
