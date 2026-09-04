import type { Metadata } from "next";

import { FadeUp } from "@/components/motion/reveal";
import { ButtonLink, Container, Eyebrow, HealthDisclaimer, Section } from "@/components/ui";

import { Calculators } from "./calculators";

export const metadata: Metadata = {
  title: "Fitness calculators",
  description:
    "Free BMI, BMR, TDEE, macro and goal-timeline calculators on both the WHO and Asian-Indian scales. The same engine that builds our 7-day diet charts.",
};

export default function ToolsPage() {
  return (
    <>
      <Section className="mesh-cool pb-10 pt-28">
        <Container>
          <FadeUp>
            <Eyebrow>Free tools</Eyebrow>
            <h1 className="mt-5 max-w-4xl text-h1 leading-display">
              Every number, <span className="grad-primary-text text-blood">live.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lead text-muted">
              BMI on both scales, BMR, TDEE, your macro split and a realistic timeline — all
              recomputed as you drag. No sign-up, nothing stored.
            </p>
          </FadeUp>
        </Container>
      </Section>

      <Section className="pt-4">
        <Container>
          <Calculators />

          <div className="mt-12 rounded-lg bg-surface p-8 shadow-e2">
            <h2 className="font-display text-h4 text-ink">Want this as an actual week of food?</h2>
            <p className="mt-3 max-w-2xl text-caption leading-relaxed text-muted">
              These are the same calculations behind our 7-day chart. The chart turns them into
              real Indian meals with katori portions, built around what you will and won&apos;t eat.
            </p>
            <ButtonLink href="/diet" className="mt-6">
              Build my free chart
            </ButtonLink>
          </div>

          <HealthDisclaimer className="mt-10" />
        </Container>
      </Section>
    </>
  );
}
