import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { Reveal } from "@/components/motion/reveal";
import { ButtonLink, Card, Container, Eyebrow, Section } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment successful" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const orderId = typeof search.order === "string" ? search.order : undefined;

  interface OrderSummary {
    tier_name_snapshot: string;
    amount_paise: number;
    status: string;
  }
  let order: OrderSummary | null = null;

  // Read through the user-scoped path so RLS confirms it is genuinely theirs.
  const admin = createAdminClient();
  const user = await getCurrentUser();
  if (admin && user && orderId) {
    const { data } = await admin
      .from("orders")
      .select("tier_name_snapshot, amount_paise, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    order = (data as OrderSummary | null) ?? null;
  }

  return (
    <Section className="min-h-[60vh]">
      <Container className="max-w-xl text-center">
        <Reveal>
          <CheckCircle2 className="mx-auto size-12 text-good" aria-hidden="true" />
          <Eyebrow className="mt-6 justify-center">Payment received</Eyebrow>
          <h1 className="mt-4 font-display text-h2 text-bone">YOU&apos;RE IN</h1>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-8 text-left">
            {order ? (
              <dl className="space-y-3 text-caption">
                <div className="flex justify-between">
                  <dt className="text-ash">Plan</dt>
                  <dd className="text-bone">{order.tier_name_snapshot}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Amount</dt>
                  <dd className="font-mono tabular-nums text-bone">
                    {formatINR(order.amount_paise)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Status</dt>
                  <dd className="text-good uppercase">{order.status}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-caption text-ash">
                Your payment is confirmed. If your plan has not unlocked yet, give it a few seconds
                and refresh — we finalise every payment against Razorpay&apos;s webhook.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/dashboard">Go to my dashboard</ButtonLink>
              <ButtonLink href="/book" variant="outline">
                Book a consult
              </ButtonLink>
            </div>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
