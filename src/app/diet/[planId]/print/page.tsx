import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Download } from "lucide-react";
import Link from "next/link";

import { PlanDayCard } from "@/components/plan/plan-day-card";
import { PrintTrigger } from "@/components/plan/print-trigger";
import { getPlan } from "@/lib/diet/storage";
import { resolveAccess } from "@/lib/entitlements";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "Print your diet chart" };

interface PageProps {
  params: Promise<{ planId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Dedicated print route rather than a print stylesheet bolted onto the
 * animated page: the chrome (header, footer, cursor, preloader) is hidden via
 * `print:hidden` rather than removed, so this still renders correctly if
 * someone lands here directly with JS disabled.
 *
 * The full plan is entitlement-gated exactly like the main plan page — a
 * printable route is not a loophole around the paywall.
 */
export default async function PrintPlanPage({ params, searchParams }: PageProps) {
  const { planId } = await params;
  const search = await searchParams;
  const entry = await getPlan(planId);
  if (!entry) notFound();

  // A printable route is not a loophole around the paywall.
  const access = await resolveAccess(entry, search, isRazorpayConfigured());
  if (!access.canView) notFound();
  if (access.level !== "full") {
    redirect(`/diet/${planId}`);
  }

  const { plan } = entry;

  return (
    <div className="mx-auto max-w-3xl bg-white px-6 py-10 text-black print:px-0 print:py-0">
      <PrintTrigger />

      <Link
        href={`/api/plan/${planId}/pdf?unlocked=1`}
        className="no-print fixed bottom-6 right-40 z-50 flex items-center gap-2 rounded-pill border border-black/15 bg-white px-5 py-3 font-sans text-sm text-black shadow-lg"
      >
        <Download className="size-4" aria-hidden="true" />
        Download PDF
      </Link>

      <header className="mb-8 flex items-center justify-between border-b border-black/15 pb-4">
        <div>
          <p className="text-lg font-bold tracking-tight">{siteConfig.name}</p>
          <p className="text-sm text-black/60">7-Day Personalised Diet Chart</p>
        </div>
        <div className="text-right text-sm text-black/60">
          <p>{plan.metrics.targetKcal} kcal/day</p>
          <p>
            P{plan.metrics.macros.proteinG}g · C{plan.metrics.macros.carbsG}g · F
            {plan.metrics.macros.fatG}g
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        {plan.days.map((day) => (
          <PlanDayCard key={day.dayIndex} day={day} printMode />
        ))}
      </div>

      <section className="mt-8 border-t border-black/15 pt-4 text-xs leading-relaxed text-black/70">
        <p className="font-semibold text-black">Notes</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {plan.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <p className="mt-4">
          Not medical advice. Consult a doctor before starting any diet if pregnant, under 18, or
          managing a medical condition.
        </p>
      </section>
    </div>
  );
}
