import type { Metadata } from "next";

import { Reveal } from "@/components/motion/reveal";
import { Container, Eyebrow, Section } from "@/components/ui";

import { IntakeForm } from "./intake-form";

export const metadata: Metadata = {
  title: "Get your free diet chart",
  description:
    "Answer a few questions about your body and goals to get a personalised 7-day Indian diet chart, generated instantly.",
};

export default function DietIntakePage() {
  return (
    <Section className="min-h-[80vh]">
      <Container>
        <Reveal className="mb-12 text-center">
          <Eyebrow className="justify-center">Free diet chart</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-h2 leading-display text-bone">
            NINETY SECONDS TO YOUR CHART
          </h1>
        </Reveal>

        <IntakeForm />
      </Container>
    </Section>
  );
}
