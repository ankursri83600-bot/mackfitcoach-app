"use client";

import { useActionState, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { BmiGauge } from "@/components/motion/bmi-gauge";
import { usePrefersReducedMotion } from "@/components/motion/use-in-view";
import { ALLERGEN_OPTIONS } from "@/lib/diet/foods";
import { bmi } from "@/lib/diet/metrics";
import { ACTIVITY_LABEL, GOAL_LABEL, WEEKDAY_SHORT } from "@/lib/diet/constants";
import type {
  ActivityLevel,
  AllergenTag,
  DietType,
  Gender,
  Goal,
  MealsPerDay,
  Weekday,
} from "@/lib/diet/types";
import { cn } from "@/lib/utils";
import { HealthDisclaimer } from "@/components/ui";

import { submitIntake, type IntakeFormState } from "./actions";

interface WizardState {
  step: number;
  goal: Goal | null;
  age: string;
  gender: Gender | null;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | null;
  dietType: DietType | null;
  nonVegDays: Weekday[];
  excludeTags: AllergenTag[];
  mealsPerDay: MealsPerDay;
}

type Action =
  | { type: "SET"; field: keyof WizardState; value: WizardState[keyof WizardState] }
  | { type: "TOGGLE_DAY"; day: Weekday }
  | { type: "TOGGLE_TAG"; tag: AllergenTag }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "GOTO"; step: number };

const TOTAL_STEPS = 6;

const initialState: WizardState = {
  step: 0,
  goal: null,
  age: "",
  gender: null,
  heightCm: "",
  weightKg: "",
  activityLevel: null,
  dietType: null,
  nonVegDays: [],
  excludeTags: [],
  mealsPerDay: 4,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "TOGGLE_DAY":
      return {
        ...state,
        nonVegDays: state.nonVegDays.includes(action.day)
          ? state.nonVegDays.filter((d) => d !== action.day)
          : [...state.nonVegDays, action.day],
      };
    case "TOGGLE_TAG":
      return {
        ...state,
        excludeTags: state.excludeTags.includes(action.tag)
          ? state.excludeTags.filter((t) => t !== action.tag)
          : [...state.excludeTags, action.tag],
      };
    case "NEXT":
      return { ...state, step: Math.min(TOTAL_STEPS - 1, state.step + 1) };
    case "BACK":
      return { ...state, step: Math.max(0, state.step - 1) };
    case "GOTO":
      return { ...state, step: Math.max(0, Math.min(TOTAL_STEPS - 1, action.step)) };
  }
}

function canAdvance(state: WizardState): boolean {
  switch (state.step) {
    case 0:
      return state.goal !== null;
    case 1:
      return Boolean(state.gender) && Number(state.age) >= 15 && Number(state.age) <= 90;
    case 2:
      return Number(state.heightCm) >= 120 && Number(state.weightKg) >= 30;
    case 3:
      return state.activityLevel !== null;
    case 4:
      return (
        state.dietType !== null &&
        (state.dietType !== "non_veg" || state.nonVegDays.length > 0)
      );
    default:
      return true;
  }
}

const initialFormState: IntakeFormState = { error: null, fieldErrors: {} };

export function IntakeForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [formState, formAction, pending] = useActionState(submitIntake, initialFormState);
  const [direction, setDirection] = useState(1);
  const reduce = usePrefersReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const liveBmi = useMemo(() => {
    const h = Number(state.heightCm);
    const w = Number(state.weightKg);
    if (!h || !w || h < 50 || w < 20) return null;
    return bmi(w, h);
  }, [state.heightCm, state.weightKg]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const go = (next: (s: WizardState) => WizardState, dir: number) => {
    setDirection(dir);
    // Direction is derived before the reducer runs so the step transition
    // slides the correct way even though React batches the state update.
    dispatch(dir > 0 ? { type: "NEXT" } : { type: "BACK" });
  };

  const progress = ((state.step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-10">
        <div className="flex items-center justify-between text-caption text-ash">
          <span aria-live="polite">
            Step {state.step + 1} of {TOTAL_STEPS}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="mt-2 h-px w-full overflow-hidden bg-hairline">
          <div
            className="h-full bg-blood"
            style={{
              width: `${progress}%`,
              transition: "width 400ms var(--ease-out-expo)",
            }}
          />
        </div>
      </div>

      {/* BMI preview shows as soon as height and weight are known. */}
      {state.step >= 2 && liveBmi !== null ? (
        <div className="mb-8 flex justify-center">
          <BmiGauge bmi={liveBmi} />
        </div>
      ) : null}

      <form action={formAction}>
        {/* Hidden fields mirror wizard state into the submitted FormData. */}
        <input type="hidden" name="goal" value={state.goal ?? ""} />
        <input type="hidden" name="age" value={state.age} />
        <input type="hidden" name="gender" value={state.gender ?? ""} />
        <input type="hidden" name="heightCm" value={state.heightCm} />
        <input type="hidden" name="weightKg" value={state.weightKg} />
        <input type="hidden" name="activityLevel" value={state.activityLevel ?? ""} />
        <input type="hidden" name="dietType" value={state.dietType ?? ""} />
        {state.nonVegDays.map((d) => (
          <input key={d} type="hidden" name="nonVegDays" value={d} />
        ))}
        {state.excludeTags.map((t) => (
          <input key={t} type="hidden" name="excludeTags" value={t} />
        ))}
        <input type="hidden" name="mealsPerDay" value={state.mealsPerDay} />

        {/*
          Steps are built as an array and indexed by state.step, rather than a
          chain of sibling `{state.step === N && (...)}` expressions — mainly for
          readability, since each block is easy to extract later.

          The step transition is a CSS animation keyed on state.step, not an
          animation-library presence transition. An earlier version used
          AnimatePresence around a keyed element and reproducibly froze: the exit
          animation would settle (opacity:1, no inline transform, exactly one
          fieldset in the DOM — a finished state, not mid-animation) while the DOM
          still showed the PREVIOUS step's content, even though the component had
          already re-rendered with the correct step several times over. Confirmed
          by logging state.step at the exact line selecting stepNodes[state.step].
          Re-keying the element and letting CSS animate the entrance is both
          simpler and correct, and costs no JS.
        */}
        {(() => {
          const stepNodes = [
            (
              <Step key="step-0" legend="What's your main goal?">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["fat_loss", "muscle_gain", "maintenance"] as Goal[]).map((g) => (
                    <OptionCard
                      key={g}
                      selected={state.goal === g}
                      onClick={() => dispatch({ type: "SET", field: "goal", value: g })}
                    >
                      {GOAL_LABEL[g]}
                    </OptionCard>
                  ))}
                </div>
              </Step>
            ),
            (
              <Step key="step-1" legend="Tell us about you">
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-caption text-ash">Age</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={15}
                      max={90}
                      value={state.age}
                      onChange={(e) => dispatch({ type: "SET", field: "age", value: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. 28"
                      required
                    />
                  </label>
                  <div className="flex flex-col gap-2">
                    <span className="text-caption text-ash">Biological sex</span>
                    <div className="flex gap-3">
                      {(["male", "female"] as Gender[]).map((g) => (
                        <OptionCard
                          key={g}
                          compact
                          selected={state.gender === g}
                          onClick={() => dispatch({ type: "SET", field: "gender", value: g })}
                        >
                          {g === "male" ? "Male" : "Female"}
                        </OptionCard>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-caption text-ash-dim">
                  Biological sex changes the BMR formula and calorie floor — it is not asking about
                  gender identity.
                </p>
              </Step>
            ),
            (
              <Step key="step-2" legend="Height and weight">
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-caption text-ash">Height (cm)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={120}
                      max={220}
                      value={state.heightCm}
                      onChange={(e) =>
                        dispatch({ type: "SET", field: "heightCm", value: e.target.value })
                      }
                      className={inputClass}
                      placeholder="e.g. 172"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-caption text-ash">Weight (kg)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={30}
                      max={250}
                      value={state.weightKg}
                      onChange={(e) =>
                        dispatch({ type: "SET", field: "weightKg", value: e.target.value })
                      }
                      className={inputClass}
                      placeholder="e.g. 78"
                      required
                    />
                  </label>
                </div>
              </Step>
            ),
            (
              <Step key="step-3" legend="How active are you day to day?">
                <div className="flex flex-col gap-3">
                  {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((level) => (
                    <OptionCard
                      key={level}
                      row
                      selected={state.activityLevel === level}
                      onClick={() =>
                        dispatch({ type: "SET", field: "activityLevel", value: level })
                      }
                    >
                      <span className="font-display text-sm uppercase tracking-[0.08em]">
                        {level.replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-caption text-ash">{ACTIVITY_LABEL[level]}</span>
                    </OptionCard>
                  ))}
                </div>
              </Step>
            ),
            (
              <Step key="step-4" legend="Food rules">
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["vegan", "vegetarian", "non_veg"] as DietType[]).map((d) => (
                    <OptionCard
                      key={d}
                      selected={state.dietType === d}
                      onClick={() => dispatch({ type: "SET", field: "dietType", value: d })}
                    >
                      {d === "non_veg" ? "Non-veg" : d === "vegan" ? "Vegan" : "Vegetarian"}
                    </OptionCard>
                  ))}
                </div>

                {state.dietType === "non_veg" ? (
                  <div className="overflow-hidden">
                      <p className="mb-3 mt-6 text-caption text-ash">
                        Which days do you eat meat or fish?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_SHORT.map((label, i) => (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={state.nonVegDays.includes(i as Weekday)}
                            onClick={() => dispatch({ type: "TOGGLE_DAY", day: i as Weekday })}
                            className={cn(
                              "rounded-pill border px-4 py-2 font-display text-xs tracking-[0.1em] uppercase transition-colors",
                              state.nonVegDays.includes(i as Weekday)
                                ? "border-blood bg-blood text-bone"
                                : "border-hairline-hi text-ash hover:border-bone/40",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                  </div>
                ) : null}

                <div className="mt-8">
                  <p className="mb-3 text-caption text-ash">Any allergies to avoid?</p>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGEN_OPTIONS.map(({ tag, label }) => (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={state.excludeTags.includes(tag)}
                        onClick={() => dispatch({ type: "TOGGLE_TAG", tag })}
                        className={cn(
                          "rounded-pill border px-4 py-2 text-caption transition-colors",
                          state.excludeTags.includes(tag)
                            ? "border-blood bg-blood/15 text-blood-bright"
                            : "border-hairline-hi text-ash hover:border-bone/40",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </Step>
            ),
            (
              <Step key="step-5" legend="Meals per day">
                <div className="grid grid-cols-4 gap-3">
                  {([3, 4, 5, 6] as MealsPerDay[]).map((n) => (
                    <OptionCard
                      key={n}
                      selected={state.mealsPerDay === n}
                      onClick={() => dispatch({ type: "SET", field: "mealsPerDay", value: n })}
                    >
                      {n}
                    </OptionCard>
                  ))}
                </div>

                <div className="mt-8 rounded-md border border-hairline bg-surface p-5">
                  <p className="font-display text-sm uppercase tracking-[0.1em] text-bone">
                    Ready to generate
                  </p>
                  <p className="mt-2 text-caption text-ash">
                    Day 1 of your chart is free to preview. Unlock the full week any time.
                  </p>
                </div>

                {formState.error ? (
                  <p role="alert" className="mt-4 text-caption text-blood-bright">
                    {formState.error}
                  </p>
                ) : null}

                <HealthDisclaimer className="mt-6" />
              </Step>
            ),
          ];

          // Re-keying on state.step restarts the CSS entrance animation, and the
          // direction decides which side it slides in from.
          return (
            <fieldset
              key={state.step}
              className="min-h-[280px]"
              style={
                reduce
                  ? undefined
                  : {
                      animation: `step-in-${direction > 0 ? "forward" : "back"} 320ms var(--ease-out-expo) both`,
                    }
              }
            >
              {stepNodes[state.step]}
            </fieldset>
          );
        })()}

        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => go((s) => s, -1)}
            disabled={state.step === 0}
            className="font-display text-sm uppercase tracking-[0.14em] text-ash transition-colors hover:text-bone disabled:pointer-events-none disabled:opacity-30"
          >
            Back
          </button>

          {state.step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => go((s) => s, 1)}
              disabled={!canAdvance(state)}
              className="rounded-pill bg-blood px-8 py-3.5 font-display text-sm uppercase tracking-[0.16em] text-bone transition-colors hover:bg-blood-bright disabled:pointer-events-none disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-blood px-9 py-3.5 font-display text-sm uppercase tracking-[0.16em] text-bone transition-colors hover:bg-blood-bright disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "Building your chart…" : "Generate my chart"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "rounded-sm border border-hairline-hi bg-surface px-4 py-3 text-bone outline-none transition-colors focus:border-blood";

function Step({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <>
      <h2 tabIndex={-1} className="font-display text-h4 text-bone outline-none">
        {legend}
      </h2>
      <div className="mt-6">{children}</div>
    </>
  );
}

function OptionCard({
  children,
  selected,
  onClick,
  compact,
  row,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  row?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-md border px-5 py-4 text-left font-display text-sm uppercase tracking-[0.06em] transition-colors duration-200",
        row && "flex flex-col gap-1 normal-case tracking-normal",
        compact && "px-6 py-3",
        selected
          ? "border-blood bg-blood/10 text-blood-bright"
          : "border-hairline-hi text-bone hover:border-bone/40",
      )}
    >
      {children}
    </button>
  );
}
