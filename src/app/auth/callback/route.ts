import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { CLAIM_COOKIE } from "@/lib/entitlements";
import { claimGuestPlan } from "@/lib/diet/storage";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

/**
 * Email-confirmation and OAuth landing route.
 *
 * Supabase has TWO shapes for this link and which one arrives depends on the
 * project's email template, not on anything this app controls:
 *
 *   1. PKCE            ?code=<uuid>
 *   2. Token hash      ?token_hash=<hash>&type=signup|recovery|email_change|…
 *
 * The original route only understood the first, so a project on the newer
 * default template landed here, found no `code`, and bounced to
 * /login?error=missing_code — indistinguishable from a broken link. Both are
 * handled now.
 *
 * NOTE ON THE COMMON FAILURE: if the confirmation email points at
 * localhost, that is NOT this route. Supabase refuses any `emailRedirectTo`
 * that is not in the project's redirect allowlist and silently substitutes the
 * project's Site URL, which defaults to http://localhost:3000. Fix it in
 * Authentication → URL Configuration, not here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  /**
   * Prefer the configured public origin over the request's own.
   *
   * On Vercel a request can arrive at the immutable deployment host
   * (mackfitcoach-abc123-team.vercel.app). Redirecting back to THAT host works,
   * but strands the user on a URL that changes with every deploy — and any
   * auth cookie set for it is invisible on the real domain. Falling back to
   * `origin` keeps local development working.
   */
  const base = siteConfig.url?.startsWith("http") ? siteConfig.url.replace(/\/$/, "") : origin;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Supabase reports its own failures on the query string before we ever run.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(providerError.slice(0, 200))}`,
    );
  }

  // Only allow same-site destinations: `next` arrives from a URL the user can
  // edit, so an absolute value would make this an open redirect.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${base}/login?error=missing_code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${base}/login?error=not_configured`);
  }

  let userId: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(error.message.slice(0, 200))}`,
      );
    }
    userId = data.user?.id;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // `signup` is the right default: this route is linked from the confirm
      // email, and a wrong type produces a confusing "token expired".
      type: (type ?? "signup") as "signup" | "recovery" | "invite" | "email_change" | "magiclink",
    });
    if (error) {
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(error.message.slice(0, 200))}`,
      );
    }
    userId = data.user?.id;
  }

  // A password-recovery link must land on the reset form, not the dashboard —
  // the user has a session but has not chosen a password yet.
  const destination = type === "recovery" ? "/auth/reset" : next;

  const claim = request.cookies.get(CLAIM_COOKIE)?.value;
  if (claim && userId) {
    await claimGuestPlan(userId, claim);
  }

  const response = NextResponse.redirect(`${base}${destination}`);
  if (claim) response.cookies.delete(CLAIM_COOKIE);
  return response;
}
