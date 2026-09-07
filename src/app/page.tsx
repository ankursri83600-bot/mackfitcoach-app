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
import { cn, formatINR } from "@/lib/utils";

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
      <InsideTheGym />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden">
      <ParallaxImage
        src="/coach/hero.jpg"
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
          lineClassName="text-ink last:text-display-gradient"
        />

        <FadeUp delay={0.5} className="mt-8 max-w-xl">
          <p className="text-lead text-muted">
            A 7-day Indian diet chart built from your own numbers — weight, height, age, activity
            and goal. Choose vegan, vegetarian, or exactly which days you eat non-veg. Then talk to
            a real dietician.
          </p>
        </FadeUp>

        <FadeUp delay={0.62} className="mt-10 flex flex-wrap items-center gap-4">
          <MagneticButton
            href="/diet"
            className="inline-flex items-center gap-2 rounded-pill bg-blood px-8 py-4 font-display text-sm tracking-[0.16em] uppercase text-canvas transition-colors duration-200 hover:bg-blood-bright"
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
              <span key={item} className="inline-flex items-center gap-2 text-caption text-muted">
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
            <span className="font-display text-sm tracking-[0.24em] text-ink/70">{item}</span>
            <MarqueeDot />
          </span>
        ))}
      </Marquee>
    </div>
  );
}

/**
 * One accent per stat, in a fixed order.
 *
 * Four identical near-black numerals gave the eye nothing to hold onto and
 * made the row read as a table. Colour here is not decoration: it is what
 * separates four unrelated facts that happen to share a shape. Positional,
 * not semantic, so it stays stable as the copy changes.
 */
const STAT_ACCENTS = [
  { text: "text-blood", ring: "ring-blood/20", tint: "bg-blood-tint" },
  { text: "text-ember-deep", ring: "ring-ember/25", tint: "bg-ember-tint" },
  { text: "text-leaf-deep", ring: "ring-leaf/25", tint: "bg-leaf-tint" },
  { text: "text-ocean-deep", ring: "ring-ocean/25", tint: "bg-ocean-tint" },
] as const;

function Stats() {
  return (
    <Section className="mesh-warm border-b border-hairline">
      <Container>
        <Reveal stagger={0.09} as="ul" className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {siteConfig.stats.map((stat, i) => {
            const accent = STAT_ACCENTS[i % STAT_ACCENTS.length];
            return (
              <RevealItem as="li" key={stat.label}>
                <div
                  className={cn(
                    "h-full rounded-lg p-6 ring-1 ring-inset backdrop-blur-[2px]",
                    "transition-transform duration-500 ease-out-quart hover:-translate-y-1 motion-reduce:hover:translate-y-0",
                    accent.tint,
                    accent.ring,
                  )}
                >
                  <p className={cn("font-display text-h2 leading-none", accent.text)}>
                    <CountUp to={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-3 text-caption tracking-[0.14em] uppercase text-muted">
                    {stat.label}
                  </p>
                </div>
              </RevealItem>
            );
          })}
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
              lineClassName="text-ink"
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
                <p className="font-display text-lg text-ink">{t.displayName}</p>
                <p className="font-mono text-caption tabular-nums text-blood-bright">
                  {t.endKg < t.startKg ? "−" : "+"}
                  {Math.abs(t.startKg - t.endKg).toFixed(0)} kg
                </p>
              </div>
              <p className="mt-1 text-caption text-muted">
                {t.goalLabel} · {t.weeks} weeks
              </p>
            </RevealItem>
          ))}
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mt-8 text-caption text-muted-dim">
            Drag each slider — or use the arrow keys — to compare. Every plan was built from the
            same intake form you can fill in for free.
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
          className="mt-5 max-w-3xl font-display text-h2 leading-display text-ink"
        />

        <Reveal stagger={0.1} as="ul" className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item, i) => {
            // The rule above each step carries the accent too, so the colour
            // reads as a sequence marker rather than four random highlights.
            const step = [
              { num: "text-blood", rule: "bg-blood/45" },
              { num: "text-ember-deep", rule: "bg-ember/55" },
              { num: "text-leaf-deep", rule: "bg-leaf/55" },
              { num: "text-ocean-deep", rule: "bg-ocean/55" },
            ][i % 4];
            return (
              <RevealItem as="li" key={item.step} className="group pt-6">
                <span aria-hidden="true" className={cn("mb-6 block h-0.5 w-full origin-left rounded-pill transition-transform duration-500 ease-out-quart group-hover:scale-x-105", step.rule)} />
                <span className={cn("font-display text-h3", step.num)}>{item.step}</span>
                <h3 className="mt-3 font-display text-h4 text-ink">{item.title}</h3>
                <p className="mt-3 text-caption leading-relaxed text-muted">{item.body}</p>
              </RevealItem>
            );
          })}
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
            className="mt-5 font-display text-h2 leading-display text-ink"
          />
          <Reveal delay={0.1}>
            <p className="mt-5 text-muted">
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

                <h3 className="font-display text-h4 text-ink">{tier.name}</h3>
                <p className="mt-1 text-caption text-muted">{tier.tagline}</p>

                <div className="mt-6 flex items-baseline gap-3">
                  <span className="font-display text-h3 tabular-nums text-ink">
                    {formatINR(tier.pricePaise)}
                  </span>
                  {tier.comparePaise ? (
                    <span className="font-mono text-caption tabular-nums text-muted-dim line-through">
                      {formatINR(tier.comparePaise)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-caption text-muted-dim">
                  {tier.durationWeeks} weeks of coaching
                  {tier.consults > 0 ? ` · ${tier.consults} consults` : ""}
                </p>

                <ul className="mt-7 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3 text-caption text-muted">
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
          className="mt-5 max-w-3xl font-display text-h2 leading-display text-ink"
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
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas to-transparent p-5 pt-16">
                    <Badge tone={coach.kind === "dietician" ? "blood" : "neutral"}>
                      {coach.kind}
                    </Badge>
                    <h3 className="mt-3 font-display text-h4 text-ink">{coach.name}</h3>
                    <p className="text-caption text-muted">{coach.headline}</p>
                  </div>
                </div>
              </Link>
              <p className="mt-4 text-caption leading-relaxed text-muted">{coach.bio}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {coach.specialties.map((s) => (
                  <li
                    key={s}
                    className="rounded-pill border border-hairline px-3 py-1 font-mono text-[0.65rem] text-muted-dim"
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

/**
 * Real photographs of the coach, in his own gym.
 *
 * Deliberately NOT a carousel. A carousel hides three of the four frames
 * behind an interaction almost nobody performs; a staggered grid shows all
 * four at once and lets the scroll reveal do the sequencing for free. The
 * portrait shots are tall (5:4 vertical) so a phone shows one per thumb-scroll
 * instead of four postage stamps.
 */
const GYM_FRAMES = [
  { src: "/coach/gallery-1.jpg", alt: "Coach Mack between sets at the rack", span: "lg:row-span-2" },
  { src: "/coach/gallery-2.jpg", alt: "Coach Mack working a cable curl", span: "" },
  { src: "/coach/gallery-3.jpg", alt: "Studio portrait of Coach Mack", span: "" },
  { src: "/coach/gallery-4.jpg", alt: "Coach Mack, second studio frame", span: "lg:row-span-2" },
] as const;

function InsideTheGym() {
  return (
    <Section className="bg-surface-2">
      <Container>
        <FadeUp>
          <Eyebrow>On the floor</Eyebrow>
          <h2 className="mt-5 max-w-3xl text-h2">Not stock photos. Him.</h2>
          <p className="mt-5 max-w-xl text-lead text-muted">
            Every plan on this site is written by the person in these frames.
          </p>
        </FadeUp>

        <Reveal
          as="ul"
          className="mt-14 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4"
          stagger={0.09}
        >
          {GYM_FRAMES.map((frame, i) => (
            <RevealItem as="li" key={frame.src} className={frame.span}>
              <figure
                className="group relative h-full overflow-hidden rounded-lg bg-surface-3 shadow-e1
                           transition-[box-shadow,transform] duration-500 ease-out-quart
                           hover:-translate-y-1.5 hover:shadow-e3 motion-reduce:hover:translate-y-0"
              >
                <Image
                  src={frame.src}
                  alt={frame.alt}
                  width={1100}
                  height={1400}
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out-quart
                             group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
                  /* The first two are near the fold on tall screens. */
                  loading={i < 2 ? "eager" : "lazy"}
                />
                {/* A hairline inside the frame: on paper an image needs an edge,
                    and a border on the <figure> would sit outside the radius. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-ink/10"
                />
              </figure>
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
            className="mt-5 font-display text-h2 leading-display text-ink"
          />
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-sm text-caption leading-relaxed text-muted">
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
                  className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg tracking-[0.01em] text-ink marker:hidden"
                >
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-hairline-hi text-muted transition-transform duration-300 group-open:rotate-45 group-open:border-blood group-open:text-blood-bright"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-caption leading-relaxed text-muted">{faq.a}</p>
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
          className="mx-auto mt-6 max-w-5xl font-display text-h1 leading-mega tracking-mega text-ink"
        />
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton
              href="/diet"
              className="inline-flex items-center gap-2 rounded-pill bg-blood px-9 py-4 font-display text-sm tracking-[0.16em] uppercase text-canvas transition-colors hover:bg-blood-bright"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Build my diet chart
            </MagneticButton>
            <ButtonLink href="/book" variant="solid">
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
