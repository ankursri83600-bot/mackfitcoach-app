import { Flame, Lock } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui";
import type { PlanDay } from "@/lib/diet/types";
import { cn } from "@/lib/utils";

export function PlanDayCard({ day, printMode }: { day: PlanDay; printMode?: boolean }) {
  return (
    <div
      className={cn(
        "print-day rounded-lg border border-hairline bg-surface p-6",
        printMode && "border-black/15 bg-white p-0",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-h4 text-bone print:text-black">
          {day.label}
          {day.isNonVegDay ? (
            <Badge tone="blood" className="ml-3 align-middle">
              Non-veg day
            </Badge>
          ) : null}
        </h3>
        <p className="font-mono text-caption tabular-nums text-ash print:text-black/60">
          {day.totals.kcal} kcal · P{day.totals.protein}g · C{day.totals.carbs}g · F{day.totals.fat}g
        </p>
      </div>

      <div className="mt-5 divide-y divide-hairline print:divide-black/10">
        {day.meals.map((meal) => (
          <div key={meal.slotId} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-sm uppercase tracking-[0.08em] text-bone print:text-black">
                {meal.label} <span className="text-ash">· {meal.timeHint}</span>
              </p>
              <p className="flex items-center gap-1 font-mono text-caption tabular-nums text-ash print:text-black/60">
                <Flame className="size-3" aria-hidden="true" />
                {meal.totals.kcal} kcal
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {meal.items.map((item) => (
                <li
                  key={item.foodId}
                  className="flex items-baseline justify-between gap-4 text-caption text-ash print:text-black/80"
                >
                  <span>
                    {item.name} <span className="text-ash-dim print:text-black/50">— {item.measure}</span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{item.kcal} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LockedDayCard({ day }: { day: Pick<PlanDay, "label" | "dayIndex"> }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 backdrop-blur-md">
        <div className="h-full w-full bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_2px,transparent_2px,transparent_10px)]" />
      </div>
      <div className="relative flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Lock className="size-5 text-ash" aria-hidden="true" />
        <p className="font-display text-h4 text-bone">{day.label}</p>
        <p className="text-caption text-ash">Unlock the full week to see this day's meals.</p>
      </div>
    </div>
  );
}

export function DaySkeletonBlur({ day }: { day: PlanDay }) {
  return (
    <Reveal>
      <LockedDayCard day={day} />
    </Reveal>
  );
}
