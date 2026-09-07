import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { CLAIM_COOKIE } from "@/lib/entitlements";
import { claimGuestPlan } from "@/lib/diet/storage";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

/**
 * Email-confirmation and OAuth landing route.
 *
 * Supabase has TWO shapes for this link:
 *   1. PKCE            ?code=<uuid>
 *   2. Token hash      ?token_hash=<hash>&type=signup|recovery|email_change|…
 *
 * We explicitly write auth session cookies to the redirect response object.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // Determine redirect base: if siteConfig has a production domain use it, else fallback to current origin.
  const base =
    siteConfig.url?.startsWith("http") && !siteConfig.url.includes("localhost")
      ? siteConfig.url.replace(/\/$/, "")
      : origin;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Supabase reports errors on the query string if the link expired or was invalid.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(providerError.slice(0, 200))}`,
    );
  }

  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${base}/login?error=missing_code`);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${base}/login?error=not_configured`);
  }

  const destination = type === "recovery" ? "/auth/reset" : next;
  const redirectUrl = `${base}${destination}`;
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  let userId: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error);
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(error.message.slice(0, 200))}`,
      );
    }
    userId = data.user?.id;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type ?? "signup") as "signup" | "recovery" | "invite" | "email_change" | "magiclink",
    });
    if (error) {
      console.error("[auth/callback] verifyOtp error:", error);
      return NextResponse.redirect(
        `${base}/login?error=${encodeURIComponent(error.message.slice(0, 200))}`,
      );
    }
    userId = data.user?.id;
  }

  const claim = request.cookies.get(CLAIM_COOKIE)?.value;
  if (claim && userId) {
    await claimGuestPlan(userId, claim).catch(() => {});
    response.cookies.delete(CLAIM_COOKIE);
  }

  return response;
}
