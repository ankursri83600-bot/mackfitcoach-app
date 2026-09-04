import type { Metadata } from "next";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container, Eyebrow, Section } from "@/components/ui";
import { FAQS } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about the diet charts, coaching plans and payments.",
};

export default function FaqPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="mt-4 font-display text-h2 text-bone">QUESTIONS, ANSWERED</h1>
        </Reveal>

        <Reveal stagger={0.06} as="ul" className="mt-12 divide-y divide-hairline border-t border-hairline">
          {FAQS.map((faq) => (
            <RevealItem as="li" key={faq.q}>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg text-bone marker:hidden">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-hairline-hi text-ash transition-transform duration-300 group-open:rotate-45 group-open:border-blood group-open:text-blood-bright"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 text-caption leading-relaxed text-ash">{faq.a}</p>
              </details>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}
