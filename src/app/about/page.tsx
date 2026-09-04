import type { Metadata } from "next";
import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { SplitText } from "@/components/motion/split-text";
import { ButtonLink, Container, Eyebrow, Section } from "@/components/ui";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About the coach",
  description: `About ${siteConfig.name} — coaching philosophy and how the plans are built.`,
};

export default function AboutPage() {
  return (
    <Section>
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Reveal>
          <div className="relative aspect-4/5 overflow-hidden rounded-md bg-surface">
            <Image
              src="/placeholder/coach-mack.jpg"
              alt="Coach Mack"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow>About</Eyebrow>
            <SplitText
              as="h1"
              text="COACHING THAT FITS YOUR KITCHEN."
              onScroll
              className="mt-5 font-display text-h2 leading-display text-bone"
            />
          </Reveal>

          <Reveal delay={0.1} as="div" className="mt-6 flex flex-col gap-4 text-ash">
            <p>
              Most diet plans fail for one boring reason: they ask people to eat food they do not
              cook, cannot afford, or do not enjoy. A plan built around chicken breast and quinoa is
              useless to someone whose family eats dal and roti every night.
            </p>
            <p>
              So this works the other way round. The chart is generated from an Indian food library
              measured in katoris and rotis, it respects vegan and vegetarian rules properly, and if
              you only eat non-veg on Wednesdays and Sundays, that is exactly what the week looks
              like.
            </p>
            <p>
              The numbers are not guesswork either. Your calorie target comes from the Mifflin-St
              Jeor equation and your activity level, with a hard safety floor so no automated tool
              can hand you a starvation diet. Where the plan cannot hit a target with the food
              available, it says so rather than quietly falling short.
            </p>
            <p>
              After that, a real dietician reviews paid plans, and you talk to a human on WhatsApp or
              the phone. Software does the arithmetic; people do the coaching.
            </p>
          </Reveal>

          <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/diet">Build my free chart</ButtonLink>
            <ButtonLink href="/book" variant="outline">
              Book a consult
            </ButtonLink>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
