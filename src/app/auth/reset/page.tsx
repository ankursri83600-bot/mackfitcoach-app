"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, Input, SupabaseNotice } from "@/components/form";
import { Button, Card, Container, Eyebrow, Section } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for the emailed recovery link. Supabase puts the recovery session
 * in place from the URL fragment, so updateUser is all that is needed here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Section className="min-h-[60vh]">
      <Container className="max-w-md">
        <Eyebrow>Account</Eyebrow>
        <h1 className="mt-3 font-display text-h2 text-bone">SET A NEW PASSWORD</h1>

        <Card className="mt-8">
          {!supabase ? (
            <SupabaseNotice />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {error ? <FormAlert>{error}</FormAlert> : null}
              <Field label="New password" htmlFor="password" hint="At least 8 characters." required>
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
                {busy ? "Saving…" : "Save password"}
              </Button>
            </form>
          )}
        </Card>
      </Container>
    </Section>
  );
}
