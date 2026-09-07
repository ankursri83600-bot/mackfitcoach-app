/** Revalidate so newly published content appears without a redeploy. */
export const revalidate = 300;

import type { Metadata } from "next";

import { BeforeAfterSlider } from "@/components/motion/before-after-slider";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { SplitText } from "@/components/motion/split-text";
import { Badge, ButtonLink, Container, Eyebrow, Section } from "@/components/ui";
import { isShowingSamples, listTransformations } from "@/lib/data/transformations";

export const metadata: Metadata = {
  title: "Client transformations",
  description:
    "Real body transformations from MackFitCoach clients — fat loss, muscle gain and post-pregnancy recomposition.",
};

export default async function TransformationsPage() {
  const [transformations, samples] = await Promise.all([
    listTransformations(),
    isShowingSamples(),
  ]);

  return (
    <Section>
      <Container>
        <Reveal className="max-w-2xl">
          <Eyebrow>Real clients</Eyebrow>
          <SplitText
            as="h1"
            text={["THE PROOF IS", "IN THE MIRROR."]}
            onScroll
            className="mt-5 font-display text-h2 leading-display text-ink"
          />
          <p className="mt-5 text-muted">
            Drag each slider — or use the arrow keys — to compare. Every plan was built from the
            same intake form you can fill in for free.
          </p>
        </Reveal>

        <Reveal stagger={0.08} as="ul" className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {transformations.map((t) => (
            <RevealItem as="li" key={t.slug}>
              <BeforeAfterSlider
                before={{ src: t.beforeSrc, alt: `${t.displayName} before` }}
                after={{ src: t.afterSrc, alt: `${t.displayName} after` }}
                label={`${t.displayName} · ${t.weeks} weeks`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />

              <div className="mt-4 flex items-baseline justify-between gap-3">
                <p className="font-display text-lg text-ink">{t.displayName}</p>
                <p className="font-mono text-caption tabular-nums text-blood-bright">
                  {t.endKg < t.startKg ? "−" : "+"}
                  {Math.abs(t.startKg - t.endKg).toFixed(0)} kg
                </p>
              </div>
              <p className="mt-1 text-caption text-muted">
                {t.goalLabel} · {t.weeks} weeks · {t.startKg}kg → {t.endKg}kg
              </p>
              {t.testimonial ? (
                <blockquote className="mt-3 border-l-2 border-blood/60 pl-4 text-caption italic leading-relaxed text-muted">
                  “{t.testimonial}”
                </blockquote>
              ) : null}
            </RevealItem>
          ))}
        </Reveal>



        <Reveal delay={0.15} className="mt-14 text-center">
          <h2 className="font-display text-h3 text-ink">YOUR TURN</h2>
          <ButtonLink href="/diet" className="mt-6">
            Build my free chart
          </ButtonLink>
        </Reveal>
      </Container>
    </Section>
  );
}
