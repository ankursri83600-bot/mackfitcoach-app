/** Revalidate so newly published content appears without a redeploy. */
export const revalidate = 300;

import type { Metadata } from "next";

import { FormAlert } from "@/components/form";
import { siteConfig } from "@/lib/site-config";
import { Reveal } from "@/components/motion/reveal";
import { Container, Eyebrow, Section } from "@/components/ui";
import { listCoaches } from "@/lib/data/coaches";
import { upcomingDates } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";

import { BookingWidget } from "./booking-widget";

export const metadata: Metadata = {
  title: "Book a 1-to-1 consult",
  description:
    "Book a one-to-one session with a certified dietician or trainer. Pick a coach, a date and your preferred time.",
};

export default async function BookPage() {
  const coaches = await listCoaches();
  const dates = upcomingDates(21, new Date());
  const bookingEnabled = Boolean(createAdminClient());

  return (
    <Section>
      <Container>
        <Reveal className="mb-10 max-w-2xl">
          <Eyebrow>1-to-1 coaching</Eyebrow>
          <h1 className="mt-4 font-display text-h2 leading-display text-ink">
            TALK TO A REAL COACH
          </h1>
          <p className="mt-4 text-muted">
            Pick a coach, a date and a time. Once the booking is in you get a WhatsApp link and the
            coach&apos;s number so you can talk directly — no extra app to install.
          </p>
        </Reveal>

        {!bookingEnabled ? (
          <Reveal className="mb-8">
            <FormAlert tone="info">
              <strong className="text-ink">Online booking is not connected yet.</strong> Add your
              Supabase keys to enable it. In the meantime, email{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="text-ink underline">
                {siteConfig.contact.email}
              </a>
              .
            </FormAlert>
          </Reveal>
        ) : null}

        <Reveal delay={0.1}>
          <BookingWidget
            coaches={coaches.map((c) => ({
              slug: c.slug,
              name: c.name,
              kind: c.kind,
              headline: c.headline,
              photoSrc: c.photoSrc,
            }))}
            dates={dates}
            bookingEnabled={bookingEnabled}
          />
        </Reveal>
      </Container>
    </Section>
  );
}
