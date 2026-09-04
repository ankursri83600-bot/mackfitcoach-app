import { AlertTriangle, Download, Droplets, Flame, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Reveal, RevealItem } from "@/components/motion/reveal";
import { LockedDayCard, PlanDayCard } from "@/components/plan/plan-day-card";
import { MacroRing } from "@/components/plan/macro-ring";
import {
  Badge,
  ButtonLink,
  Card,
  Container,
  Eyebrow,
  HealthDisclaimer,
  Section,
} from "@/components/ui";
import { getPlan } from "@/lib/diet/storage";
import { resolveAccess } from "@/lib/entitlements";
import { isRazorpayConfigured } from "@/lib/razorpay";

export const metadata: Metadata = { title: "Your diet chart" };

interface PageProps {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlanPage({ params, searchParams }: PageProps) {
  const { planId } = await params;
  const search = await searchParams;
  const entry = await getPlan(planId);
  if (!entry) notFound();

  const access = await resolveAccess(entry, search, isRazorpayConfigured());
  if (!access.canView) notFound();

  const { plan } = entry;
  const unlocked = access.level === "full";
  const { metrics } = plan;

  return (
    <Section>
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <Reveal>
            <Eyebrow>Your plan</Eyebrow>
            <h1 className="mt-3 font-display text-h2 leading-display text-bone">
              {unlocked ? "Full 7-day chart" : "Day 1 preview"}
            </h1>
            <p className="mt-3 max-w-xl text-ash">
              Built from your BMI of {metrics.bmi}, a {metrics.targetKcal} kcal daily target, and
              your food preferences.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="flex shrink-0 gap-3">
            {unlocked ? (
              <>
                <ButtonLink href={`/diet/${planId}/print`} variant="outline">
                  <Printer className="size-4" aria-hidden="true" />
                  Print
                </ButtonLink>
                <ButtonLink href={`/api/plan/${planId}/pdf?unlocked=1`} variant="blood">
                  <Download className="size-4" aria-hidden="true" />
                  Download PDF
                </ButtonLink>
              </>
            ) : (
              <ButtonLink href={`/checkout/starter?planId=${planId}`}>
                Unlock full week
              </ButtonLink>
            )}
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <Card className="mt-10 grid gap-8 md:grid-cols-[auto_1fr]">
            <MacroRing
              proteinG={metrics.macros.proteinG}
              carbsG={metrics.macros.carbsG}
              fatG={metrics.macros.fatG}
            />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="BMR" value={`${metrics.bmr}`} unit="kcal" />
              <Stat label="TDEE" value={`${metrics.tdee}`} unit="kcal" />
              <Stat
                icon={<Flame className="size-3.5" aria-hidden="true" />}
                label="Target"
                value={`${metrics.targetKcal}`}
                unit="kcal/day"
              />
              <Stat
                icon={<Droplets className="size-3.5" aria-hidden="true" />}
                label="Water"
                value={(metrics.waterMl / 1000).toFixed(1)}
                unit="litres"
              />
            </div>
          </Card>
        </Reveal>

        {metrics.appliedFloor ? (
          <Reveal delay={0.18}>
            <div className="mt-6 flex items-start gap-3 rounded-md border border-warn/40 bg-warn/10 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-caption text-ash">
                Your calculated deficit would have gone below the safe minimum, so your target was
                raised to a safe floor.
              </p>
            </div>
          </Reveal>
        ) : null}

        {plan.warnings.length > 0 ? (
          <Reveal delay={0.2} as="ul" className="mt-6 space-y-2">
            {plan.warnings.map((w, i) => (
              <li
                key={i}
                className="rounded-md border border-blood/30 bg-blood/5 px-4 py-3 text-caption text-ash"
              >
                {w}
              </li>
            ))}
          </Reveal>
        ) : null}

        <Reveal stagger={0.08} as="div" className="mt-10 grid gap-6">
          {plan.days.map((day) => (
            <RevealItem key={day.dayIndex}>
              {unlocked || day.dayIndex === 1 ? (
                <PlanDayCard day={day} />
              ) : (
                <LockedDayCard day={day} />
              )}
            </RevealItem>
          ))}
        </Reveal>

        {!unlocked ? (
          <Reveal delay={0.1}>
            <div className="mt-10 rounded-lg border border-blood/40 bg-surface-2 p-8 text-center">
              <Badge tone="blood">6 more days locked</Badge>
              <h2 className="mt-4 font-display text-h3 text-bone">See your whole week</h2>
              <p className="mx-auto mt-3 max-w-md text-ash">
                Unlock the full 7-day chart, a printable PDF, and 1-to-1 support from a dietician.
              </p>
              <ButtonLink href={`/checkout/starter?planId=${planId}`} className="mt-6">
                Unlock full week
              </ButtonLink>
            </div>
          </Reveal>
        ) : null}

        <Reveal delay={0.1} as="div" className="mt-12 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-h4 text-bone">Notes</h2>
            <ul className="mt-4 space-y-3">
              {plan.notes.map((n, i) => (
                <li key={i} className="text-caption leading-relaxed text-ash">
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-h4 text-bone">Tips</h2>
            <ul className="mt-4 space-y-3">
              {plan.tips.map((t, i) => (
                <li key={i} className="text-caption leading-relaxed text-ash">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <HealthDisclaimer className="mt-12 max-w-3xl" />
        </Reveal>

        <Reveal delay={0.2} className="mt-6">
          <p className="text-caption text-ash-dim">
            Want to talk it through?{" "}
            <Link href="/book" className="text-blood-bright hover:underline">
              Book a call with a dietician
            </Link>
            .
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}

function Stat({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-caption text-ash">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-h4 tabular-nums text-bone">{value}</p>
      <p className="text-caption text-ash-dim">{unit}</p>
    </div>
  );
}
