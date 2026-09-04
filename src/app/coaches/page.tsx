/** Revalidate so newly published content appears without a redeploy. */
export const revalidate = 300;

import type { Metadata } from "next";
import Image from "next/image";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { SplitText } from "@/components/motion/split-text";
import { Badge, ButtonLink, Container, Eyebrow, Section } from "@/components/ui";
import { listCoaches } from "@/lib/data/coaches";

export const metadata: Metadata = {
  title: "Our coaches",
  description: "Meet the dietician and trainers behind MackFitCoach.",
};

export default async function CoachesPage() {
  const coaches = await listCoaches();

  return (
    <Section>
      <Container>
        <Reveal className="max-w-2xl">
          <Eyebrow>Your coaches</Eyebrow>
          <SplitText
            as="h1"
            text="COACHED BY PEOPLE, NOT AN APP."
            onScroll
            className="mt-5 font-display text-h2 leading-display text-bone"
          />
        </Reveal>

        <Reveal stagger={0.1} as="ul" className="mt-14 grid gap-10 md:grid-cols-3">
          {coaches.map((coach) => (
            <RevealItem as="li" key={coach.slug}>
              <div className="relative aspect-4/5 overflow-hidden rounded-md bg-surface">
                <Image
                  src={coach.photoSrc}
                  alt={coach.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-5 pt-16">
                  <Badge tone={coach.kind === "dietician" ? "blood" : "neutral"}>{coach.kind}</Badge>
                  <h2 className="mt-3 font-display text-h4 text-bone">{coach.name}</h2>
                  <p className="text-caption text-ash">{coach.headline}</p>
                </div>
              </div>

              <p className="mt-4 text-caption leading-relaxed text-ash">{coach.bio}</p>

              {coach.specialties.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {coach.specialties.map((s) => (
                    <li
                      key={s}
                      className="rounded-pill border border-hairline px-3 py-1 font-mono text-[0.65rem] text-ash-dim"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              ) : null}

              <ButtonLink href="/book" variant="outline" className="mt-5">
                Book with {coach.name.split(" ")[0]}
              </ButtonLink>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}
