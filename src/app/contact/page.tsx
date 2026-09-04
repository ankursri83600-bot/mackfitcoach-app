import { Mail } from "lucide-react";
import type { Metadata } from "next";

import { Reveal } from "@/components/motion/reveal";
import { Card, Container, Eyebrow, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${siteConfig.name} on WhatsApp, phone or email.`,
};

export default function ContactPage() {
  return (
    <Section>
      <Container className="max-w-2xl">
        <Reveal>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-4 font-display text-h2 text-ink">TALK TO US</h1>
          <p className="mt-4 text-muted">
            Email us and a human replies — not a bot. Booking a call gets you a coach&apos;s
            direct WhatsApp once the slot is confirmed.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-10 flex flex-col gap-5">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-center gap-4 rounded-md border border-hairline p-4 transition-colors hover:border-blood"
            >
              <Mail className="size-5 text-blood" aria-hidden="true" />
              <span>
                <span className="block text-caption text-ink">Email</span>
                <span className="block text-[0.7rem] text-muted">{siteConfig.contact.email}</span>
              </span>
            </a>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
