"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { deleteWeightLog, logWeight, type LogResult, type WeightPoint } from "./progress-actions";

const IDLE: LogResult = { ok: false };

const input =
  "w-full rounded-sm border border-hairline-hi bg-surface px-3 py-2 text-caption text-ink outline-none transition-colors focus:border-blood";
const label = "block text-[0.66rem] uppercase tracking-[0.14em] text-muted";

/**
 * Weight progress.
 *
 * The chart plots every logged point AND a 7-day moving average. The raw line
 * alone is close to useless for judging progress: day-to-day body weight swings
 * a kilo or more on water and glycogen, so a reader looking at raw dots
 * concludes they gained weight roughly half the time regardless of the trend.
 * The average is the line that answers "is this working".
 */
export function Progress({ points, targetKg }: { points: WeightPoint[]; targetKg?: number }) {
  const [state, action, pending] = useActionState(logWeight, IDLE);
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => computeStats(points), [points]);

  return (
    <div className="rounded-lg bg-surface p-6 shadow-e2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-h4 text-ink">Progress</h2>
        {stats ? (
          <p
            className={cn(
              "inline-flex items-center gap-1.5 text-caption font-semibold tabular-nums",
              stats.totalChange < 0 ? "text-leaf-deep" : stats.totalChange > 0 ? "text-ember-deep" : "text-muted",
            )}
          >
            {stats.totalChange < 0 ? (
              <TrendingDown className="size-4" aria-hidden="true" />
            ) : stats.totalChange > 0 ? (
              <TrendingUp className="size-4" aria-hidden="true" />
            ) : null}
            {stats.totalChange > 0 ? "+" : ""}
            {stats.totalChange.toFixed(1)} kg
          </p>
        ) : null}
      </div>

      {points.length === 0 ? (
        <p className="mt-3 text-caption text-muted">
          Log your weight once a week, same time of day, ideally first thing after waking. One
          reading is a number; a month of readings is a trend.
        </p>
      ) : (
        <>
          <Chart points={points} targetKg={targetKg} />

          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Latest" value={`${stats!.latest.toFixed(1)} kg`} />
            <Stat label="Start" value={`${stats!.first.toFixed(1)} kg`} />
            <Stat
              label="7-day avg"
              value={stats!.movingAvg ? `${stats!.movingAvg.toFixed(1)} kg` : "—"}
            />
            <Stat
              label="Rate"
              value={stats!.weeklyRate === null ? "—" : `${stats!.weeklyRate > 0 ? "+" : ""}${stats!.weeklyRate.toFixed(2)} kg/wk`}
              hint={stats!.weeklyRate === null ? "Need 2+ weeks" : undefined}
            />
          </dl>
        </>
      )}

      {/* ---- Log form ---- */}
      <form action={action} className="mt-6 flex flex-wrap items-end gap-3 border-t border-hairline pt-5">
        <div className="w-28">
          <label className={label} htmlFor="w-kg">
            Weight (kg)
          </label>
          <input
            id="w-kg"
            name="weightKg"
            type="number"
            step="0.1"
            min={20}
            max={400}
            required
            placeholder="78.4"
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div className="w-40">
          <label className={label} htmlFor="w-date">
            Date
          </label>
          <input
            id="w-date"
            name="loggedOn"
            type="date"
            defaultValue={today}
            max={today}
            required
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label className={label} htmlFor="w-note">
            Note (optional)
          </label>
          <input
            id="w-note"
            name="note"
            maxLength={280}
            placeholder="Slept badly, ate out Saturday"
            className={cn(input, "mt-1.5")}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill grad-blood px-6 py-2.5 font-display text-[0.72rem] uppercase tracking-[0.16em] text-white shadow-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-sm bg-blood-tint px-3 py-2 text-caption text-blood-deep">
          {state.error}
        </p>
      ) : null}

      <p className="mt-2 text-[0.62rem] text-muted-dim">
        Logging the same date again corrects that entry rather than adding a second one.
      </p>

      {points.length > 0 ? <History points={points} /> : null}
    </div>
  );
}

function Stat({ label: l, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-muted">{l}</dt>
      <dd className="mt-1 font-display text-h4 text-ink tabular-nums">{value}</dd>
      {hint ? <p className="text-[0.62rem] text-muted-dim">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- chart ---- */

function Chart({ points, targetKg }: { points: WeightPoint[]; targetKg?: number }) {
  const W = 720;
  const H = 200;
  const PAD = 8;

  const avg = movingAverage(points.map((p) => p.weight_kg), 7);

  const values = points.map((p) => p.weight_kg);
  const candidates = targetKg ? [...values, targetKg] : values;
  let min = Math.min(...candidates);
  let max = Math.max(...candidates);
  // A flat week would otherwise divide by zero and collapse the line onto an
  // edge; give it a kilo of breathing room either side.
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }
  const span = max - min;

  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);

  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      // A gap in the moving average (its first six points) must not draw a
      // straight line from the origin — restart the path instead.
      .join(" ")
      .replace(/^L/, "M");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-5 h-52 w-full overflow-visible"
      role="img"
      aria-label={`Weight over ${points.length} entries, from ${points[0].weight_kg} to ${points[points.length - 1].weight_kg} kilograms`}
    >
      <defs>
        <linearGradient id="wFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ocean)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-ocean)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {targetKg && targetKg >= min && targetKg <= max ? (
        <>
          <line
            x1="0"
            x2={W}
            y1={y(targetKg)}
            y2={y(targetKg)}
            stroke="var(--color-leaf)"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <text x="4" y={y(targetKg) - 6} className="fill-leaf-deep" fontSize="11">
            target {targetKg} kg
          </text>
        </>
      ) : null}

      {points.length > 1 ? (
        <path d={`${line(values)} L${W},${H} L0,${H} Z`} fill="url(#wFill)" />
      ) : null}

      {/* Raw readings: thin and pale — present, but not the story. */}
      <path
        d={line(values)}
        fill="none"
        stroke="var(--color-ocean)"
        strokeWidth="1.5"
        strokeOpacity="0.45"
        strokeLinejoin="round"
      />

      {/* The 7-day average is the line that actually answers the question. */}
      <path
        d={line(avg)}
        fill="none"
        stroke="var(--color-blood)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.weight_kg)} r="2.5" fill="var(--color-ocean)" />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------- history ---- */

function History({ points }: { points: WeightPoint[] }) {
  const [open, setOpen] = useState(false);
  const recent = [...points].reverse();

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-caption text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        {open ? "Hide" : "Show"} all {points.length} entries
      </button>

      {open ? (
        <ul className="mt-3 divide-y divide-hairline">
          {recent.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-caption">
              <span className="w-24 shrink-0 font-mono tabular-nums text-muted">{p.logged_on}</span>
              <span className="w-16 shrink-0 font-semibold tabular-nums text-ink">
                {p.weight_kg.toFixed(1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-dim">{p.note ?? ""}</span>
              <form action={deleteWeightLog}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  aria-label={`Delete entry for ${p.logged_on}`}
                  className="text-muted-dim transition-colors hover:text-blood"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- maths ---- */

/** Trailing mean; null until there are `window` points to average. */
function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    return sum / window;
  });
}

function computeStats(points: WeightPoint[]) {
  if (points.length === 0) return null;

  const first = points[0].weight_kg;
  const latest = points[points.length - 1].weight_kg;
  const avg = movingAverage(points.map((p) => p.weight_kg), 7);
  const movingAvg = [...avg].reverse().find((v) => v !== null) ?? null;

  /**
   * Rate is computed over ELAPSED DAYS, not over entry count.
   *
   * Dividing the change by the number of logs assumes daily weighing. Someone
   * logging weekly would see their rate reported as seven times reality —
   * which, on a fat-loss plan, reads as dangerously fast progress.
   */
  const days =
    (Date.parse(points[points.length - 1].logged_on) - Date.parse(points[0].logged_on)) / 86_400_000;
  const weeklyRate = days >= 14 ? ((latest - first) / days) * 7 : null;

  return { first, latest, totalChange: latest - first, movingAvg, weeklyRate };
}
