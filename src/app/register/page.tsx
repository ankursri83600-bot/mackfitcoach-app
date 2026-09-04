"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, Input, SupabaseNotice } from "@/components/form";
import { Button, Card, Container, Eyebrow, Section } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Carried into profiles by the handle_new_user trigger.
        data: { full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setBusy(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // With email confirmation on, there is no session yet.
    if (!data.session) {
      setNotice("Check your email to confirm your account, then log in.");
      return;
    }

    // Attach any plan generated as a guest before signing up.
    await fetch("/api/claim-plan", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Section className="min-h-[70vh]">
      <Container className="max-w-md">
        <Eyebrow>Account</Eyebrow>
        <h1 className="mt-3 font-display text-h2 text-bone">CREATE ACCOUNT</h1>
        <p className="mt-3 text-caption text-ash">
          An account keeps your charts, orders and bookings in one place.
        </p>

        <Card className="mt-8">
          {!supabase ? (
            <SupabaseNotice />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {error ? <FormAlert>{error}</FormAlert> : null}
              {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

              <Field label="Full name" htmlFor="fullName" required>
                <Input
                  id="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>

              <Field label="Phone" htmlFor="phone" hint="Used for WhatsApp coaching only.">
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 99999 99999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>

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

              <Field label="Password" htmlFor="password" hint="At least 8 characters." required>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              <Button type="submit" disabled={busy}>
                {busy ? "Creating account…" : "Create account"}
              </Button>

              <p className="text-caption text-ash">
                Already have one?{" "}
                <Link href="/login" className="text-blood-bright hover:underline">
                  Log in
                </Link>
              </p>
            </form>
          )}
        </Card>
      </Container>
    </Section>
  );
}
