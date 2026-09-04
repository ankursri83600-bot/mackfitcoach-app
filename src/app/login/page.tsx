import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, Container, Eyebrow, Section } from "@/components/ui";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

/**
 * Server shell around the client form.
 *
 * The form reads `?next=` with useSearchParams, which forces a client-side
 * bailout during prerender unless it sits inside a Suspense boundary — without
 * this split the production build fails outright.
 */
export default function LoginPage() {
  return (
    <Section className="min-h-[70vh]">
      <Container className="max-w-md">
        <Eyebrow>Account</Eyebrow>
        <h1 className="mt-3 font-display text-h2 text-bone">LOG IN</h1>

        <Suspense fallback={<Card className="mt-8"><p className="text-caption text-ash">Loading…</p></Card>}>
          <LoginForm />
        </Suspense>
      </Container>
    </Section>
  );
}
