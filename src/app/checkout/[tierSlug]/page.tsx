import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormAlert } from "@/components/form";
import { Reveal } from "@/components/motion/reveal";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { Card, Container, Eyebrow, Section } from "@/components/ui";
import { findTier } from "@/lib/data/content";
import { getPlan } from "@/lib/diet/storage";
import { isRazorpayConfigured, razorpayConfigStatus } from "@/lib/razorpay";
import { getCurrentUser } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

import { DemoUnlockButton } from "./demo-unlock-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tierSlug: string }>;
}): Promise<Metadata> {
  const { tierSlug } = await params;
  const tier = findTier(tierSlug);
  return { title: tier ? `Checkout — ${tier.name}` : "Checkout" };
}

interface PageProps {
  params: Promise<{ tierSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const { tierSlug } = await params;
  const search = await searchParams;
  const tier = findTier(tierSlug);
  if (!tier) notFound();

  const planId = typeof search.planId === "string" ? search.planId : undefined;
  const paymentsLive = isRazorpayConfigured();
  const rzp = razorpayConfigStatus();
  const user = await getCurrentUser();

  // Attach the purchase to the plan's intake row when we know it.
  const stored = planId ? await getPlan(planId) : null;
  const dietRequestId = stored?.requestId ?? undefined;

  return (
    <Section className="min-h-[70vh]">
      <Container className="max-w-2xl">
        <Reveal>
          <Eyebrow>Checkout</Eyebrow>
          <h1 className="mt-3 font-display text-h2 text-bone">{tier.name}</h1>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-ash">{tier.tagline}</p>
              <p className="font-display text-h3 tabular-nums text-bone">
                {formatINR(tier.pricePaise)}
              </p>
            </div>

            <ul className="mt-6 space-y-3">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-3 text-caption text-ash">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-blood-bright" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {paymentsLive ? (
                <>
                  {!user ? (
                    <FormAlert tone="info">
                      You will be asked to{" "}
                      <Link href={`/login?next=/checkout/${tier.slug}`} className="text-bone underline">
                        sign in
                      </Link>{" "}
                      before paying, so the plan stays attached to your account.
                    </FormAlert>
                  ) : null}
                  <RazorpayCheckout
                    tierSlug={tier.slug}
                    tierName={tier.name}
                    planId={planId}
                    dietRequestId={dietRequestId}
                  />
                </>
              ) : (
                <>
                  <FormAlert tone="info">
                    {rzp.keyIdPresent ? (
                      <>
                        <strong className="text-bone">
                          Almost there — your {rzp.mode} key ID is set.
                        </strong>{" "}
                        Payments still need{" "}
                        {rzp.missing
                          .filter((v) => v !== "RAZORPAY_WEBHOOK_SECRET")
                          .map((v) => (
                            <code key={v} className="text-bone">
                              {v}
                            </code>
                          ))
                          .reduce<React.ReactNode[]>(
                            (acc, node, i) => (i === 0 ? [node] : [...acc, " and ", node]),
                            [],
                          )}{" "}
                          in <code className="text-bone">.env.local</code>. Razorpay signs every
                        request with the secret, so the server cannot create an order without it.
                      </>
                    ) : (
                      <>
                        <strong className="text-bone">Payments are not connected yet.</strong> Add{" "}
                        <code className="text-bone">RAZORPAY_KEY_ID</code> and{" "}
                        <code className="text-bone">RAZORPAY_KEY_SECRET</code> to{" "}
                        <code className="text-bone">.env.local</code>.
                      </>
                    )}{" "}
                    The button below only demonstrates the unlock flow — no money moves.
                  </FormAlert>
                  <DemoUnlockButton
                    planId={planId}
                    tierSlug={tier.slug}
                    className="mt-4 w-full"
                  />
                </>
              )}
            </div>

            <p className="mt-6 text-[0.7rem] leading-relaxed text-ash-dim">
              Prices are in Indian rupees and include all taxes. See our{" "}
              <Link href="/refund-policy" className="underline">
                refund policy
              </Link>{" "}
              before purchasing.
            </p>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
