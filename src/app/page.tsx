/** Revalidate so newly published content appears without a redeploy. */
export const revalidate = 300;

import { ArrowRight, Check, Clock, MessageCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LogoBadge } from "@/components/brand/logo";
import { BeforeAfterSlider } from "@/components/motion/before-after-slider";
import { CountUp } from "@/components/motion/count-up";
import { MagneticButton } from "@/components/motion/magnetic";
import { Marquee, MarqueeDot } from "@/components/motion/marquee";
import { ParallaxImage } from "@/components/motion/parallax-image";
import { FadeUp, Reveal, RevealItem } from "@/components/motion/reveal";
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
import { FAQS, HOW_IT_WORKS, MARQUEE_ITEMS, PLAN_TIERS } from "@/lib/data/content";
import { listCoaches } from "@/lib/data/coaches";
import { listTransformations } from "@/lib/data/transformations";
import { siteConfig } from "@/lib/site-config";
import { formatINR } from "@/lib/utils";

export default async function HomePage() {
  // Live data when Supabase is configured, labelled samples otherwise.
  const [coaches, transformations] = await Promise.all([
    listCoaches(),
    listTransformations(),
  ]);

  return (
    <>
      <Hero />
      <CredentialsMarquee />
      <Stats />
      <Transformations items={transformations.slice(0, 4)} />
      <HowItWorks />
      <Pricing />
      <Coaches items={coaches} />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden">
      <ParallaxImage
        src="/placeholder/hero.jpg"
        alt=""
        priority
        speed={0.12}
        className="absolute inset-0 -z-10"
        sizes="100vw"
        scrim
      />

      {/* Oversized rotating ghost badge. Decorative, very low contrast. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/2 -z-10 hidden -translate-y-1/2 opacity-[0.055] lg:block"
        style={{ animation: "spin-slow 90s linear infinite" }}
      >
        <LogoBadge size={720} decorative />
      </div>

      <Container className="py-28">
        <FadeUp delay={0.05}>
          <Eyebrow>{siteConfig.contact.city} · Online coaching</Eyebrow>
        </FadeUp>

        <SplitText
          as="h1"
          text={["BUILT FOR", "YOUR BODY."]}
          by="char"
          delay={0.15}
          className="mt-6 font-display text-mega leading-mega tracking-mega"
          lineClassName="text-bone last:text-display-gradient"
        />

        <FadeUp delay={0.5} className="mt-8 max-w-xl">
          <p className="text-lead text-ash">
            A 7-day Indian diet chart built from your own numbers — weight, height, age, activity
            and goal. Choose vegan, vegetarian, or exactly which days you eat non-veg. Then talk to
            a real dietician.
          </p>
        </FadeUp>

        <FadeUp delay={0.62} className="mt-10 flex flex-wrap items-center gap-4">
          <MagneticButton
            href="/diet"
            className="inline-flex items-center gap-2 rounded-pill bg-blood px-8 py-4 font-display text-sm tracking-[0.16em] uppercase text-bone transition-colors duration-200 hover:bg-blood-bright"
          >
            Get my free chart
            <ArrowRight className="size-4" aria-hidden="true" />
          </MagneticButton>
          <ButtonLink href="/transformations" variant="outline">
            See transformations
          </ButtonLink>
        </FadeUp>

        <FadeUp delay={0.75} className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
          {["Day 1 free, no card", "Built in 90 seconds", "Indian meals, katori portions"].map(
            (item) => (
              <span key={item} className="inline-flex items-center gap-2 text-caption text-ash">
                <Check className="size-3.5 text-blood-bright" aria-hidden="true" />
                {item}
              </span>
            ),
          )}
        </FadeUp>
      </Container>
    </section>
  );
}

function CredentialsMarquee() {
  return (
    <div className="border-y border-hairline bg-surface/60 py-5">
      <Marquee duration={36}>
        {MARQUEE_ITEMS.map((item) => (
          <span key={item} className="flex items-center">
            <span className="font-display text-sm tracking-[0.24em] text-bone/70">{item}</span>
            <MarqueeDot />
          </span>
        ))}
      </Marquee>
    </div>
  );
}

function Stats() {
  return (
    <Section className="border-b border-hairline">
      <Container>
        <Reveal stagger={0.09} as="ul" className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {siteConfig.stats.map((stat) => (
            <RevealItem as="li" key={stat.label}>
              <p className="font-display text-h2 leading-none text-bone">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-3 text-caption tracking-[0.14em] uppercase text-ash">
                {stat.label}
              </p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

function Transformations({ items }: { items: Awaited<ReturnType<typeof listTransformations>> }) {
  return (
    <Section id="transformations">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <Eyebrow>Real clients</Eyebrow>
            </Reveal>
            <SplitText
              as="h2"
              text={["THE PROOF IS", "IN THE MIRROR."]}
              onScroll
              className="mt-5 font-display text-h2 leading-display"
              lineClassName="text-bone"
            />
          </div>
          <Reveal delay={0.1}>
            <Link
              href="/transformations"
              className="inline-flex items-center gap-2 font-display text-sm tracking-[0.16em] uppercase text-blood-bright"
            >
              View all
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>

        <Reveal stagger={0.1} as="ul" className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((t) => (
            <RevealItem as="li" key={t.slug}>
              <BeforeAfterSlider
                before={{ src: t.beforeSrc, alt: `${t.displayName} before` }}
                after={{ src: t.afterSrc, alt: `${t.displayName} after` }}
                label={`${t.displayName} · ${t.weeks} weeks`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <p className="font-display text-lg text-bone">{t.displayName}</p>
                <p className="font-mono text-caption tabular-nums text-blood-bright">
                  {t.endKg < t.startKg ? "−" : "+"}
                  {Math.abs(t.startKg - t.endKg).toFixed(0)} kg
                </p>
              </div>
              <p className="mt-1 text-caption text-ash">
                {t.goalLabel} · {t.weeks} weeks
              </p>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mt-8 text-caption text-ash-dim">
            Drag the handle — or use the arrow keys — to compare. Images shown are samples
            pending client photo consent.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section className="border-y border-hairline bg-surface/40">
      <Container>
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
        </Reveal>
        <SplitText
          as="h2"
          text="FOUR STEPS. NO GUESSWORK."
          onScroll
          className="mt-5 max-w-3xl font-display text-h2 leading-display text-bone"
        />

        <Reveal stagger={0.1} as="ul" className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <RevealItem as="li" key={item.step} className="border-t border-hairline pt-6">
              <span className="font-display text-h3 text-blood">{item.step}</span>
              <h3 className="mt-3 font-display text-h4 text-bone">{item.title}</h3>
              <p className="mt-3 text-caption leading-relaxed text-ash">{item.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

function Pricing() {
  return (
    <Section id="pricing">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
          </Reveal>
          <SplitText
            as="h2"
            text={["PAY ONCE.", "EAT RIGHT FOR MONTHS."]}
            onScroll
            className="mt-5 font-display text-h2 leading-display text-bone"
          />
          <Reveal delay={0.1}>
            <p className="mt-5 text-ash">
              Day one of your chart is always free. Unlock the rest when you are ready.
            </p>
          </Reveal>
        </div>

        <Reveal stagger={0.12} as="ul" className="mt-14 grid gap-6 lg:grid-cols-3">
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

                <h3 className="font-display text-h4 text-bone">{tier.name}</h3>
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
                  {tier.durationWeeks} weeks of coaching
                  {tier.consults > 0 ? ` · ${tier.consults} consults` : ""}
                </p>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3 text-caption text-ash">
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-blood-bright"
                        aria-hidden="true"
                      />
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
      </Container>
    </Section>
  );
}

function Coaches({ items }: { items: Awaited<ReturnType<typeof listCoaches>> }) {
  return (
    <Section className="border-y border-hairline bg-surface/40">
      <Container>
        <Reveal>
          <Eyebrow>Your coaches</Eyebrow>
        </Reveal>
        <SplitText
          as="h2"
          text="COACHED BY PEOPLE, NOT AN APP."
          onScroll
          className="mt-5 max-w-3xl font-display text-h2 leading-display text-bone"
        />

        <Reveal stagger={0.1} as="ul" className="mt-14 grid gap-8 md:grid-cols-3">
          {items.map((coach) => (
            <RevealItem as="li" key={coach.slug}>
              <Link href={`/coaches/${coach.slug}`} className="group block">
                <div className="relative aspect-4/5 overflow-hidden rounded-md bg-surface">
                  <Image
                    src={coach.photoSrc}
                    alt={coach.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-5 pt-16">
                    <Badge tone={coach.kind === "dietician" ? "blood" : "neutral"}>
                      {coach.kind}
                    </Badge>
                    <h3 className="mt-3 font-display text-h4 text-bone">{coach.name}</h3>
                    <p className="text-caption text-ash">{coach.headline}</p>
                  </div>
                </div>
              </Link>
              <p className="mt-4 text-caption leading-relaxed text-ash">{coach.bio}</p>
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
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

function Faq() {
  return (
    <Section>
      <Container className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
          </Reveal>
          <SplitText
            as="h2"
            text={["QUESTIONS,", "ANSWERED."]}
            onScroll
            className="mt-5 font-display text-h2 leading-display text-bone"
          />
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-sm text-caption leading-relaxed text-ash">
              Still unsure? Message the coach directly on WhatsApp — you will get a human reply,
              not a bot.
            </p>
            <ButtonLink href="/contact" variant="outline" className="mt-6">
              <MessageCircle className="size-4" aria-hidden="true" />
              Ask a question
            </ButtonLink>
          </Reveal>
        </div>

        {/* Native details/summary so this works with zero JS. */}
        <Reveal stagger={0.06} as="ul" className="divide-y divide-hairline border-t border-hairline">
          {FAQS.map((faq) => (
            <RevealItem as="li" key={faq.q}>
              <details className="group py-5">
                <summary
                  className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg tracking-[0.01em] text-bone marker:hidden"
                >
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-hairline-hi text-ash transition-transform duration-300 group-open:rotate-45 group-open:border-blood group-open:text-blood-bright"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-caption leading-relaxed text-ash">{faq.a}</p>
              </details>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section className="relative isolate overflow-hidden border-t border-hairline">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(196,38,43,0.16),transparent_65%)]"
      />
      <Container className="text-center">
        <Reveal>
          <Eyebrow className="justify-center">Start today</Eyebrow>
        </Reveal>
        <SplitText
          as="h2"
          text={["STOP GUESSING.", "START TRANSFORMING."]}
          by="char"
          onScroll
          className="mx-auto mt-6 max-w-5xl font-display text-h1 leading-mega tracking-mega text-bone"
        />
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton
              href="/diet"
              className="inline-flex items-center gap-2 rounded-pill bg-blood px-9 py-4 font-display text-sm tracking-[0.16em] uppercase text-bone transition-colors hover:bg-blood-bright"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Build my diet chart
            </MagneticButton>
            <ButtonLink href="/book" variant="bone">
              <Clock className="size-4" aria-hidden="true" />
              Book a 1-to-1 call
            </ButtonLink>
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <HealthDisclaimer className="mx-auto mt-12 max-w-2xl text-center" />
        </Reveal>
      </Container>
    </Section>
  );
}
