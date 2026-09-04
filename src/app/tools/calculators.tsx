"use client";

import { useMemo, useState, useId } from "react";

import {
  ACTIVITY_LABEL,
  GOAL_LABEL,
  KCAL_FLOOR,
  computeMetrics,
  idealWeightKg,
  type ActivityLevel,
  type Gender,
  type Goal,
  type UserInput,
} from "@/lib/diet";
import { cn } from "@/lib/utils";

/**
 * The calculator suite.
 *
 * Every number here comes from `@/lib/diet` — the same pure engine that builds
 * the paid 7-day plan. That is deliberate and worth protecting: if these
 * calculators grew their own copy of Mifflin-St Jeor, the free tool and the
 * paid plan would drift apart and the first person to notice would be a paying
 * customer whose numbers moved after checkout.
 *
 * Everything recomputes synchronously on each render. The engine is measured
 * at well under a millisecond for a full plan, so a handful of scalar
 * functions do not need memoising for speed — `useMemo` below is only to keep
 * a stable object identity for the chart children.
 */

const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "athlete"];

const GOALS: Goal[] = ["fat_loss", "muscle_gain", "maintenance"];

/** The engine needs a whole UserInput; the calculators only vary these six. */
function toUserInput(s: {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}): UserInput {
  return {
    ...s,
    dietType: "vegetarian",
    nonVegDays: [],
    excludeTags: [],
    excludeFoodIds: [],
    mealsPerDay: 4,
  };
}

export function Calculators() {
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState<Gender>("male");
  const [heightCm, setHeightCm] = useState(172);
  const [weightKg, setWeightKg] = useState(78);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<Goal>("fat_loss");

  const m = useMemo(
    () => computeMetrics(toUserInput({ age, gender, heightCm, weightKg, activityLevel, goal })),
    [age, gender, heightCm, weightKg, activityLevel, goal],
  );

  const ideal = idealWeightKg(heightCm);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      {/* ---- Controls ---- */}
      <div className="rounded-lg bg-surface p-6 shadow-e2 lg:sticky lg:top-24">
        <h2 className="font-display text-h4 text-ink">Your numbers</h2>
        <p className="mt-1 text-caption text-muted">Everything updates as you drag.</p>

        <div className="mt-6 space-y-6">
          <Segmented
            label="Sex"
            value={gender}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
            onChange={setGender}
          />

          <Slider label="Age" value={age} min={14} max={90} unit="yrs" onChange={setAge} />
          <Slider
            label="Height"
            value={heightCm}
            min={130}
            max={215}
            unit="cm"
            onChange={setHeightCm}
          />
          <Slider
            label="Weight"
            value={weightKg}
            min={35}
            max={200}
            unit="kg"
            onChange={setWeightKg}
          />

          <Select
            label="Activity"
            value={activityLevel}
            options={ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_LABEL[a] }))}
            onChange={setActivityLevel}
          />
          <Select
            label="Goal"
            value={goal}
            options={GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
            onChange={setGoal}
          />
        </div>
      </div>

      {/* ---- Results ---- */}
      <div className="space-y-6">
        <BmiPanel bmi={m.bmi} who={m.bmiCategoryWho} asian={m.bmiCategoryAsian} ideal={ideal} weightKg={weightKg} />

        <div className="grid gap-6 sm:grid-cols-3">
          <StatTile label="BMR" value={m.bmr} unit="kcal" hint="At complete rest" grad="grad-info" shadow="shadow-info" />
          <StatTile label="TDEE" value={m.tdee} unit="kcal" hint="Burned per day" grad="grad-success" shadow="shadow-success" />
          <StatTile
            label="Target"
            value={m.targetKcal}
            unit="kcal"
            hint={m.appliedFloor ? `Floor of ${KCAL_FLOOR[gender]} applied` : GOAL_LABEL[goal]}
            grad="grad-blood"
            shadow="shadow-accent"
            warn={m.appliedFloor}
          />
        </div>

        <MacroPanel macros={m.macros} kcal={m.targetKcal} waterMl={m.waterMl} />

        <ProjectionPanel
          weeklyKg={m.projectedWeeklyKg}
          timeline={m.timeline}
          weightKg={weightKg}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ BMI ---- */

/**
 * Two scales, side by side, because in India they disagree and the difference
 * is clinically real: the Asian-Indian cutoff for overweight is 23, not 25.
 * Showing only the WHO scale tells a 24-BMI visitor they are fine when the
 * scale that applies to them says otherwise.
 */
const BMI_BANDS = [
  { upTo: 18.5, label: "Under", cls: "bg-ocean" },
  { upTo: 23, label: "Healthy", cls: "bg-leaf" },
  { upTo: 25, label: "Asian OW", cls: "bg-ember" },
  { upTo: 30, label: "Overweight", cls: "bg-blood" },
  { upTo: 40, label: "Obese", cls: "bg-blood-deep" },
] as const;

function BmiPanel({
  bmi,
  who,
  asian,
  ideal,
  weightKg,
}: {
  bmi: number;
  who: string;
  asian: string;
  ideal: number;
  weightKg: number;
}) {
  // The scale runs 14–40; anything outside is pinned so the marker stays on it.
  const pct = Math.min(100, Math.max(0, ((bmi - 14) / (40 - 14)) * 100));
  const delta = Math.round((weightKg - ideal) * 10) / 10;

  return (
    <div className="rounded-lg bg-surface p-6 shadow-e2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption uppercase tracking-[0.18em] text-muted">Body mass index</p>
          <p className="mt-1 font-display text-h1 leading-none text-ink tabular-nums">
            {bmi.toFixed(1)}
          </p>
        </div>
        <div className="text-right text-caption">
          <p className="text-muted">
            WHO <span className="font-semibold text-ink">{who}</span>
          </p>
          <p className="mt-1 text-muted">
            Asian-Indian <span className="font-semibold text-ink">{asian}</span>
          </p>
        </div>
      </div>

      {/* Band strip */}
      <div className="relative mt-7">
        <div className="flex h-3 overflow-hidden rounded-pill">
          {BMI_BANDS.map((b, i) => {
            const from = i === 0 ? 14 : BMI_BANDS[i - 1].upTo;
            const width = ((b.upTo - from) / (40 - 14)) * 100;
            return <span key={b.label} className={cn(b.cls)} style={{ width: `${width}%` }} />;
          })}
        </div>

        {/* Marker. The transition is what makes dragging a slider feel live. */}
        <span
          aria-hidden="true"
          className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-pill border-4 border-surface bg-ink shadow-e2 transition-[left] duration-300 ease-out-quart"
          style={{ left: `${pct}%` }}
        />
        <div className="mt-3 flex justify-between text-[0.62rem] uppercase tracking-[0.14em] text-muted-dim">
          {BMI_BANDS.map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </div>
      </div>

      <p className="mt-6 text-caption text-muted">
        A BMI of 22 for your height is about{" "}
        <span className="font-semibold text-ink">{ideal} kg</span>
        {delta === 0 ? (
          <> — you are there.</>
        ) : (
          <>
            {" "}
            — <span className="font-semibold text-ink">{Math.abs(delta)} kg</span>{" "}
            {delta > 0 ? "above" : "below"} where you are now.
          </>
        )}{" "}
        BMI ignores muscle mass, so treat it as a starting point, not a verdict.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- tiles ---- */

function StatTile({
  label,
  value,
  unit,
  hint,
  grad,
  shadow,
  warn,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  grad: string;
  shadow: string;
  warn?: boolean;
}) {
  return (
    <div className="group rounded-lg bg-surface p-5 shadow-e2 transition-transform duration-300 ease-out-quart hover:-translate-y-1 motion-reduce:hover:translate-y-0">
      <span
        aria-hidden="true"
        className={cn(
          "mb-4 grid size-11 place-items-center rounded-md text-white transition-transform duration-500 ease-out-quart group-hover:scale-105 motion-reduce:group-hover:scale-100",
          grad,
          shadow,
        )}
      >
        <span className="font-display text-[0.7rem] tracking-[0.1em]">{label}</span>
      </span>
      <p className="font-display text-h3 leading-none text-ink tabular-nums">
        {value.toLocaleString("en-IN")}
        <span className="ml-1 text-caption font-normal text-muted">{unit}</span>
      </p>
      <p className={cn("mt-2 text-caption", warn ? "font-semibold text-blood" : "text-muted")}>
        {hint}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- macros ---- */

function MacroPanel({
  macros,
  kcal,
  waterMl,
}: {
  macros: { proteinG: number; carbsG: number; fatG: number };
  kcal: number;
  waterMl: number;
}) {
  // Share of calories, not of grams — a gram of fat is 9 kcal, a gram of
  // protein 4, so a gram-based bar would misrepresent the split badly.
  const parts = [
    { key: "Protein", g: macros.proteinG, kcal: macros.proteinG * 4, cls: "grad-info" },
    { key: "Carbs", g: macros.carbsG, kcal: macros.carbsG * 4, cls: "grad-success" },
    { key: "Fat", g: macros.fatG, kcal: macros.fatG * 9, cls: "grad-warning" },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0) || 1;

  return (
    <div className="rounded-lg bg-surface p-6 shadow-e2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-h4 text-ink">Daily macros</h3>
        <p className="text-caption text-muted">
          at {kcal.toLocaleString("en-IN")} kcal · {(waterMl / 1000).toFixed(1)} L water
        </p>
      </div>

      <div className="mt-5 flex h-4 overflow-hidden rounded-pill bg-surface-2">
        {parts.map((p) => (
          <span
            key={p.key}
            className={cn(p.cls, "transition-[width] duration-500 ease-out-quart")}
            style={{ width: `${(p.kcal / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-4">
        {parts.map((p) => (
          <li key={p.key}>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-2.5 rounded-pill", p.cls)} />
              <span className="text-caption uppercase tracking-[0.14em] text-muted">{p.key}</span>
            </div>
            <p className="mt-1 font-display text-h4 text-ink tabular-nums">
              {p.g}
              <span className="ml-0.5 text-caption font-normal text-muted">g</span>
            </p>
            <p className="text-[0.65rem] text-muted-dim tabular-nums">
              {Math.round((p.kcal / total) * 100)}% of kcal
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------- projection ---- */

function ProjectionPanel({
  weeklyKg,
  timeline,
  weightKg,
}: {
  weeklyKg: number;
  timeline: { targetWeightKg: number; deltaKg: number; weeksRealistic: number };
  weightKg: number;
}) {
  const weeks = Math.min(52, Math.max(8, timeline.weeksRealistic || 16));

  // The engine's own adherence factor is already baked into weeksRealistic;
  // this curve shows the same 85% assumption week by week rather than the
  // fantasy straight line a naive kcal/7700 chart would draw.
  const points = Array.from({ length: weeks + 1 }, (_, w) => {
    const kg = weightKg + weeklyKg * 0.85 * w;
    return { w, kg };
  });

  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs, timeline.targetWeightKg);
  const max = Math.max(...kgs, timeline.targetWeightKg);
  const span = max - min || 1;
  const W = 640;
  const H = 180;

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p.kg - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gaining = weeklyKg > 0;

  return (
    <div className="rounded-lg bg-surface p-6 shadow-e2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-h4 text-ink">Where this gets you</h3>
        <p className="text-caption text-muted tabular-nums">
          {gaining ? "+" : ""}
          {weeklyKg.toFixed(2)} kg / week
        </p>
      </div>

      {weeklyKg === 0 ? (
        <p className="mt-5 text-caption text-muted">
          Maintenance — your target matches your burn, so weight holds steady.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-5 h-44 w-full overflow-visible"
            role="img"
            aria-label={`Projected weight over ${weeks} weeks, reaching about ${points[points.length - 1].kg.toFixed(1)} kilograms`}
          >
            <defs>
              <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-ocean)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-ocean)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#projFill)" />
            <path
              d={d}
              fill="none"
              stroke="var(--color-ocean)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <dl className="mt-5 grid grid-cols-3 gap-4 text-caption">
            <div>
              <dt className="text-muted">In {weeks} weeks</dt>
              <dd className="mt-1 font-display text-h4 text-ink tabular-nums">
                {points[points.length - 1].kg.toFixed(1)} kg
              </dd>
            </div>
            <div>
              <dt className="text-muted">BMI-22 weight</dt>
              <dd className="mt-1 font-display text-h4 text-ink tabular-nums">
                {timeline.targetWeightKg} kg
              </dd>
            </div>
            <div>
              <dt className="text-muted">Realistic ETA</dt>
              <dd className="mt-1 font-display text-h4 text-ink tabular-nums">
                {timeline.weeksRealistic || "—"} wk
              </dd>
            </div>
          </dl>
        </>
      )}

      <p className="mt-5 text-[0.65rem] leading-relaxed text-muted-dim">
        Assumes 85% adherence, which is what the engine uses for the paid plan too. It is a
        straight-line estimate: TDEE falls as you lose weight, so real progress flattens toward
        the end.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- inputs ---- */

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-caption uppercase tracking-[0.14em] text-muted">
          {label}
        </label>
        <span className="font-display text-lg text-ink tabular-nums">
          {value}
          <span className="ml-1 text-caption font-normal text-muted">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // The filled portion is painted with a background gradient whose hard
        // stop follows the value, so there is no second element to keep in sync.
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-pill outline-none
                   [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-white
                   [&::-webkit-slider-thumb]:shadow-e2 [&::-webkit-slider-thumb]:ring-2
                   [&::-webkit-slider-thumb]:ring-blood
                   [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-pill
                   [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white
                   [&::-moz-range-thumb]:shadow-e2"
        style={{
          background: `linear-gradient(to right, var(--color-blood) 0%, var(--color-blood-bright) ${pct}%, var(--color-surface-3) ${pct}%, var(--color-surface-3) 100%)`,
        }}
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-caption uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="mt-2 grid grid-flow-col rounded-pill bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-pill px-4 py-2 font-display text-[0.72rem] uppercase tracking-[0.14em] transition-all duration-200",
              value === o.value
                ? "grad-blood text-white shadow-accent"
                : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-caption uppercase tracking-[0.14em] text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-2 w-full rounded-md border border-hairline-hi bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-blood"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
