import { TOLERANCE } from "./constants";
import type { Food, Totals } from "./types";

/** A slot mid-construction: chosen foods plus their current multipliers. */
export interface MutableMeal {
  slotId: string;
  foods: Food[];
  multipliers: number[];
  targetKcal: number;
}

export interface MacroTarget {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Cost weights.
 *
 * The asymmetry on protein is the important part. Weighting protein error
 * symmetrically at 3.0 made the optimiser refuse to add food: for a 57kg athlete
 * on a 3160 kcal bulk, being 10% over a 103g protein target scored worse than
 * being 430 kcal under the calorie target, so it left every item pinned at its
 * minimum portion and produced a 195 kcal "breakfast".
 *
 * Physiologically the two directions are nothing alike — surplus protein is
 * harmless, a large calorie shortfall on a bulk is a failed plan — so overshoot
 * is free up to the tolerance band and only lightly penalised beyond it.
 */
const WEIGHTS = {
  kcal: 1.5,
  proteinUnder: 3.0,
  proteinOver: 0.5,
  fat: 0.7,
  carbs: 0.25,
};

const EPS = 1e-9;

export const emptyTotals = (): Totals => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

export function foodTotals(food: Food, multiplier: number): Totals {
  return {
    kcal: food.kcal * multiplier,
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
  };
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function mealTotals(meal: MutableMeal): Totals {
  let t = emptyTotals();
  for (let i = 0; i < meal.foods.length; i++) {
    t = addTotals(t, foodTotals(meal.foods[i], meal.multipliers[i]));
  }
  return t;
}

export function dayTotals(meals: readonly MutableMeal[]): Totals {
  let t = emptyTotals();
  for (const meal of meals) t = addTotals(t, mealTotals(meal));
  return t;
}

/** Snap a multiplier to the food's step granularity and clamp to its range. */
export function clampToStep(value: number, food: Food): number {
  const stepped = Math.round(value / food.step) * food.step;
  const clamped = Math.min(food.max, Math.max(food.min, stepped));
  // Kill float drift so 1.5000000000000002 never reaches the output.
  return Math.round(clamped * 1000) / 1000;
}

/**
 * Phase 1 — continuous scale.
 *
 * Solve one common scalar that puts the slot at its calorie budget, then round
 * each item to its own step and clamp. Rounding and clamping leave residual
 * error, which phase 2 cleans up.
 */
export function scaleSlot(foods: readonly Food[], targetKcal: number): number[] {
  const baseKcal = foods.reduce((sum, f) => sum + f.kcal * f.min, 0);
  const scalar = baseKcal > 0 ? targetKcal / baseKcal : 1;
  return foods.map((f) => clampToStep(f.min * scalar, f));
}

function normSq(actual: number, target: number): number {
  if (target <= 0) return 0;
  const rel = (actual - target) / target;
  return rel * rel;
}

/** Weighted squared relative error, asymmetric on protein (see WEIGHTS). */
export function cost(totals: Totals, target: MacroTarget): number {
  const upperProtein = target.protein * TOLERANCE.proteinMaxPct;

  let proteinCost: number;
  if (totals.protein < target.protein) {
    proteinCost = WEIGHTS.proteinUnder * 2 * normSq(totals.protein, target.protein);
  } else if (totals.protein <= upperProtein) {
    // Inside the acceptable band: free, so it never blocks reaching calories.
    proteinCost = 0;
  } else {
    proteinCost = WEIGHTS.proteinOver * normSq(totals.protein, upperProtein);
  }

  return (
    WEIGHTS.kcal * normSq(totals.kcal, target.kcal) +
    proteinCost +
    WEIGHTS.fat * normSq(totals.fat, target.fat) +
    WEIGHTS.carbs * normSq(totals.carbs, target.carbs)
  );
}

export function withinTolerance(totals: Totals, target: MacroTarget): boolean {
  const kcalBand = Math.max(target.kcal * TOLERANCE.kcalPct, TOLERANCE.kcalAbsFloor);
  return (
    Math.abs(totals.kcal - target.kcal) <= kcalBand &&
    totals.protein >= target.protein * TOLERANCE.proteinMinPct &&
    totals.protein <= target.protein * TOLERANCE.proteinMaxPct &&
    Math.abs(totals.fat - target.fat) <= target.fat * TOLERANCE.fatPct
  );
}

function applyDelta(totals: Totals, food: Food, delta: number): Totals {
  return {
    kcal: totals.kcal + food.kcal * delta,
    protein: totals.protein + food.protein * delta,
    carbs: totals.carbs + food.carbs * delta,
    fat: totals.fat + food.fat * delta,
  };
}

/**
 * Phase 2 — greedy discrete descent over the whole day.
 *
 * Each pass evaluates every legal ±1-step move and applies the single best one.
 * Termination is guaranteed: cost is bounded below by zero and every accepted
 * move strictly decreases it, with a hard pass cap as a backstop.
 *
 * Determinism comes from a fixed evaluation order (slot, then item, then +step
 * before −step) combined with strict `<` comparisons, so the first-found best
 * always wins a tie. Rounding happens only at the presentation boundary — never
 * inside this loop, or accumulated error would make plans irreproducible.
 *
 * Cost per pass is ~2 evaluations per item (about 30 for a typical day) and each
 * is four multiply-adds, so a full week lands comfortably under a millisecond.
 */
export function correctDay(
  meals: MutableMeal[],
  target: MacroTarget,
  maxPasses = TOLERANCE.maxCorrectionPasses,
): { totals: Totals; converged: boolean; passes: number } {
  let totals = dayTotals(meals);
  let current = cost(totals, target);
  let passes = 0;

  for (; passes < maxPasses; passes++) {
    if (withinTolerance(totals, target)) {
      return { totals, converged: true, passes };
    }

    let best: { meal: number; item: number; delta: number; cost: number } | null = null;

    for (let m = 0; m < meals.length; m++) {
      const meal = meals[m];
      for (let i = 0; i < meal.foods.length; i++) {
        const food = meal.foods[i];
        for (const delta of [food.step, -food.step]) {
          const next = meal.multipliers[i] + delta;
          if (next < food.min - EPS || next > food.max + EPS) continue;

          const candidate = cost(applyDelta(totals, food, delta), target);
          if (candidate < current - EPS && (best === null || candidate < best.cost - EPS)) {
            best = { meal: m, item: i, delta, cost: candidate };
          }
        }
      }
    }

    // Local minimum: no single step improves things. Stop and report deviation
    // honestly rather than looping.
    if (best === null) break;

    const meal = meals[best.meal];
    meal.multipliers[best.item] = Math.round((meal.multipliers[best.item] + best.delta) * 1000) / 1000;
    totals = applyDelta(totals, meal.foods[best.item], best.delta);
    current = best.cost;
  }

  return { totals, converged: withinTolerance(totals, target), passes };
}

/** Index of the slot furthest from its own calorie budget, for repair targeting. */
export function worstSlotIndex(meals: readonly MutableMeal[]): number {
  let worst = 0;
  let worstErr = -1;
  for (let i = 0; i < meals.length; i++) {
    const t = mealTotals(meals[i]);
    const err = Math.abs(t.kcal - meals[i].targetKcal) / Math.max(meals[i].targetKcal, 1);
    if (err > worstErr) {
      worstErr = err;
      worst = i;
    }
  }
  return worst;
}
