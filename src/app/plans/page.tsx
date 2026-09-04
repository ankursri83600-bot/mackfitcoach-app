import { Check } from "lucide-react";
import type { Metadata } from "next";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { SplitText } from "@/components/motion/split-text";
import {
  Badge,
  ButtonLink,
  Card,
  Container,
  Eyebrow,
  HealthDisclaimer,
  Section,
} from "@/components/ui";
import { PLAN_TIERS } from "@/lib/data/content";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Coaching plans from ₹499. Day one of your diet chart is always free — unlock the full week when you are ready.",
};

export default function PlansPage() {
  return (
    <Section>
      <Container>
        <Reveal className="max-w-2xl">
          <Eyebrow>Pricing</Eyebrow>
          <SplitText
            as="h1"
            text={["PAY ONCE.", "EAT RIGHT FOR MONTHS."]}
            onScroll
            className="mt-5 font-display text-h2 leading-display text-bone"
          />
          <p className="mt-5 text-ash">
            Every plan starts with the same free chart. You only pay to unlock the rest of the week
            and to talk to a human.
          </p>
        </Reveal>

        <Reveal stagger={0.1} as="ul" className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLAN_TIERS.map((tier) => (
            <RevealItem as="li" key={tier.slug} className="h-full">
              <Card
                className={
                  tier.recommended
                    ? "relative h-full border-blood/60 bg-surface-2 shadow-[0_0_60px_-20px_rgba(196,38,43,0.5)]"
                    : "h-full"
                }
              >
                {tier.recommended ? (
                  <Badge tone="blood" className="absolute -top-3 left-6">
                    Most chosen
                  </Badge>
                ) : null}

                <h2 className="font-display text-h4 text-bone">{tier.name}</h2>
                <p className="mt-1 text-caption text-ash">{tier.tagline}</p>

                <div className="mt-6 flex items-baseline gap-3">
                  <span className="font-display text-h3 tabular-nums text-bone">
                    {formatINR(tier.pricePaise)}
                  </span>
                  {tier.comparePaise ? (
                    <span className="font-mono text-caption tabular-nums text-ash-dim line-through">
                      {formatINR(tier.comparePaise)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-caption text-ash-dim">
                  {tier.durationWeeks} weeks
                  {tier.consults > 0 ? ` · ${tier.consults} consults` : ""}
                </p>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3 text-caption text-ash">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-blood-bright" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={`/checkout/${tier.slug}`}
                  variant={tier.recommended ? "blood" : "outline"}
                  className="mt-8 w-full"
                >
                  Choose {tier.name}
                </ButtonLink>
              </Card>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal delay={0.15}>
          <HealthDisclaimer className="mt-14 max-w-3xl" />
        </Reveal>
      </Container>
    </Section>
  );
}
