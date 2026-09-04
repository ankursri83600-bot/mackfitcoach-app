import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { CLAIM_COOKIE } from "@/lib/entitlements";
import { claimGuestPlan } from "@/lib/diet/storage";

export const runtime = "nodejs";

/**
 * Exchanges the emailed code for a session, then attaches any guest plan the
 * visitor generated before signing up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  const claim = request.cookies.get(CLAIM_COOKIE)?.value;
  if (claim && data.user) {
    await claimGuestPlan(data.user.id, claim);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  if (claim) response.cookies.delete(CLAIM_COOKIE);
  return response;
}
