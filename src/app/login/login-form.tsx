"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, Input, SupabaseNotice } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  /**
   * Failures from /auth/callback arrive as ?error=. Previously they were
   * dropped, so a dead confirmation link looked identical to a fresh visit and
   * gave the user nothing to act on. `missing_code` in particular almost
   * always means the Site URL / redirect allowlist is wrong in Supabase, so it
   * gets a message that says so rather than echoing the raw slug.
   */
  const callbackError = params.get("error");
  const CALLBACK_MESSAGES: Record<string, string> = {
    missing_code:
      "That confirmation link did not carry a token. It may have already been used, or the link was truncated by your email client — request a new one below.",
    invalid_code: "That confirmation link has expired or was already used. Request a new one.",
    not_configured: "Sign-in is temporarily unavailable. Please try again shortly.",
  };
  const callbackMessage = callbackError
    ? (CALLBACK_MESSAGES[callbackError] ?? decodeURIComponent(callbackError))
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onReset() {
    if (!supabase || !email) {
      setError("Enter your email first, then choose 'Forgot password'.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setNotice("Check your email for a password reset link.");
  }

  return (
    <Card className="mt-8">
          {callbackMessage ? <FormAlert>{callbackMessage}</FormAlert> : null}
          {!supabase ? (
            <SupabaseNotice />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {error ? <FormAlert>{error}</FormAlert> : null}
              {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Log in"}
              </Button>

              <div className="flex items-center justify-between text-caption">
                <button
                  type="button"
                  onClick={onReset}
                  className="text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Forgot password?
                </button>
                <Link href="/register" className="text-blood-bright hover:underline">
                  Create an account
                </Link>
              </div>
            </form>
      )}
    </Card>
  );
}
