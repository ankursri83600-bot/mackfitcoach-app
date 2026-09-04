import { Mail, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";

import { Reveal } from "@/components/motion/reveal";
import { Card, Container, Eyebrow, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site-config";
import { supportWhatsappLink } from "@/lib/whatsapp";

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
          <h1 className="mt-4 font-display text-h2 text-bone">TALK TO US</h1>
          <p className="mt-4 text-ash">
            Fastest reply is WhatsApp. You will get a human, not a bot.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-10 flex flex-col gap-5">
            <a
              href={supportWhatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-md border border-hairline p-4 transition-colors hover:border-good"
            >
              <MessageCircle className="size-5 text-good" aria-hidden="true" />
              <span>
                <span className="block text-caption text-bone">WhatsApp</span>
                <span className="block text-[0.7rem] text-ash">
                  {siteConfig.contact.phoneLabel}
                </span>
              </span>
            </a>

            <a
              href={`tel:${siteConfig.contact.whatsapp}`}
              className="flex items-center gap-4 rounded-md border border-hairline p-4 transition-colors hover:border-blood"
            >
              <Phone className="size-5 text-blood" aria-hidden="true" />
              <span>
                <span className="block text-caption text-bone">Phone</span>
                <span className="block text-[0.7rem] text-ash">
                  {siteConfig.contact.phoneLabel}
                </span>
              </span>
            </a>

            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-center gap-4 rounded-md border border-hairline p-4 transition-colors hover:border-blood"
            >
              <Mail className="size-5 text-blood" aria-hidden="true" />
              <span>
                <span className="block text-caption text-bone">Email</span>
                <span className="block text-[0.7rem] text-ash">{siteConfig.contact.email}</span>
              </span>
            </a>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
