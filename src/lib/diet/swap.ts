import { FOOD_BY_ID, formatPortion } from "./foods";
import { clampToStep } from "./scale";
import { buildPool } from "./select";
import type { DietPlan, Food, PlanItem, PlanMeal, UserInput } from "./types";

/**
 * Meal swapping.
 *
 * A swap replaces ONE item with another that does the same job in the meal,
 * re-portioned to hold that item's calorie contribution. Everything here is
 * pure — the same plan and the same swap always produce the same result — so a
 * swapped plan can be re-rendered from `(plan_json, swaps)` without storing a
 * second copy of the plan.
 *
 * The plan itself is never rewritten. `diet_plans.plan_json` is the engine's
 * deterministic output keyed by a seed; editing it would make the row stop
 * matching its own seed and quietly destroy the property the whole engine is
 * built on. Overrides are applied at render time instead.
 */

export interface SwapCandidate {
  foodId: string;
  name: string;
  /** Portion needed to match the original item's calories, e.g. "1½ katori". */
  measure: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Signed difference against the item being replaced, for the UI to show. */
  deltaKcal: number;
  deltaProtein: number;
}

/**
 * Re-portion `food` so it contributes about `targetKcal`, honouring the food's
 * own step and min/max. Returns null when the food cannot get close — a
 * candidate that would need three times its maximum portion is not a swap, it
 * is a different meal.
 */
export function portionFor(food: Food, targetKcal: number): { multiplier: number } | null {
  if (food.kcal <= 0) return null;

  const raw = targetKcal / food.kcal;
  const multiplier = clampToStep(raw, food);
  const achieved = food.kcal * multiplier;

  // Clamping can land a long way from the target when the food is very dense
  // or very light. 35% is generous enough to allow a genuine substitution and
  // tight enough that the day's calories still hold.
  if (targetKcal > 0 && Math.abs(achieved - targetKcal) / targetKcal > 0.35) return null;

  return { multiplier };
}

function toCandidate(food: Food, multiplier: number, original: PlanItem): SwapCandidate {
  const kcal = Math.round(food.kcal * multiplier);
  const protein = Math.round(food.protein * multiplier * 10) / 10;
  return {
    foodId: food.id,
    name: food.name,
    measure: formatPortion(food, multiplier),
    kcal,
    protein,
    carbs: Math.round(food.carbs * multiplier * 10) / 10,
    fat: Math.round(food.fat * multiplier * 10) / 10,
    deltaKcal: kcal - original.kcal,
    deltaProtein: Math.round((protein - original.protein) * 10) / 10,
  };
}

/**
 * Valid substitutes for one item.
 *
 * The candidate pool comes from `buildPool`, which is the SAME filter the
 * generator uses — so a swap can never introduce an allergen the user
 * excluded, break a vegan plan, or put meat on a vegetarian day. Reusing it
 * rather than re-implementing the checks is the point: a second copy of that
 * logic would eventually disagree with the first, and the failure mode is
 * feeding someone an allergen.
 */
export function findSwaps(
  plan: DietPlan,
  dayIndex: number,
  slotId: string,
  foodId: string,
  limit = 8,
): SwapCandidate[] {
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  const meal = day?.meals.find((m) => m.slotId === slotId);
  const item = meal?.items.find((i) => i.foodId === foodId);
  if (!day || !meal || !item) return [];

  const original = FOOD_BY_ID.get(foodId);
  if (!original) return [];

  // `isNonVegDay` — not the user's diet type. A non-veg user still eats from
  // the vegetarian pool on the days they did not pick for meat.
  const pool = buildPool(plan.input as UserInput, day.isNonVegDay);

  // Same roles: a carb is replaced by a carb. Anything else changes what the
  // meal IS, and the generator's slot structure stops making sense.
  const roles = new Set(original.roles);

  // Never offer something already on the plate in this meal.
  const alreadyHere = new Set(meal.items.map((i) => i.foodId));

  const seen = new Set<string>();
  const out: SwapCandidate[] = [];

  for (const role of roles) {
    for (const food of pool.get(role) ?? []) {
      if (food.id === foodId || alreadyHere.has(food.id) || seen.has(food.id)) continue;
      seen.add(food.id);

      const portion = portionFor(food, item.kcal);
      if (!portion) continue;

      out.push(toCandidate(food, portion.multiplier, item));
    }
  }

  // Closest on protein first, then on calories: when someone swaps a food they
  // are usually protecting the protein number, and rank alone would surface
  // whatever is most common rather than what fits.
  out.sort(
    (a, b) =>
      Math.abs(a.deltaProtein) - Math.abs(b.deltaProtein) ||
      Math.abs(a.deltaKcal) - Math.abs(b.deltaKcal) ||
      (a.foodId < b.foodId ? -1 : 1),
  );

  return out.slice(0, limit);
}

export interface StoredSwap {
  dayIndex: number;
  slotId: string;
  fromFoodId: string;
  toFoodId: string;
}

/** Rebuild a meal's totals from its items. Kept local so this file stays pure. */
function sumItems(items: PlanItem[]) {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: Math.round((acc.protein + i.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + i.carbs) * 10) / 10,
      fat: Math.round((acc.fat + i.fat) * 10) / 10,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * Apply stored swaps to a plan, returning a NEW plan.
 *
 * Totals are recomputed all the way up — item, meal, day — so a swapped plan's
 * numbers stay internally consistent. `deviation` is left as the engine wrote
 * it: it describes how well the ENGINE hit the target, and a user's own
 * substitution should not be able to rewrite that verdict.
 */
export function applySwaps(plan: DietPlan, swaps: StoredSwap[]): DietPlan {
  if (swaps.length === 0) return plan;

  const byKey = new Map(swaps.map((s) => [`${s.dayIndex}|${s.slotId}|${s.fromFoodId}`, s]));

  const days = plan.days.map((day) => {
    let dayChanged = false;

    const meals: PlanMeal[] = day.meals.map((meal) => {
      let mealChanged = false;

      const items = meal.items.map((item) => {
        const swap = byKey.get(`${day.dayIndex}|${meal.slotId}|${item.foodId}`);
        if (!swap) return item;

        const food = FOOD_BY_ID.get(swap.toFoodId);
        if (!food) return item; // Food removed from the table since the swap.

        const portion = portionFor(food, item.kcal);
        if (!portion) return item;

        mealChanged = true;
        dayChanged = true;

        return {
          foodId: food.id,
          name: food.name,
          measure: formatPortion(food, portion.multiplier),
          qty: Math.round(food.base.qty * portion.multiplier * 10) / 10,
          unit: food.base.unit,
          multiplier: portion.multiplier,
          kcal: Math.round(food.kcal * portion.multiplier),
          protein: Math.round(food.protein * portion.multiplier * 10) / 10,
          carbs: Math.round(food.carbs * portion.multiplier * 10) / 10,
          fat: Math.round(food.fat * portion.multiplier * 10) / 10,
        } satisfies PlanItem;
      });

      return mealChanged ? { ...meal, items, totals: sumItems(items) } : meal;
    });

    if (!dayChanged) return day;

    const totals = meals.reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.totals.kcal,
        protein: Math.round((acc.protein + m.totals.protein) * 10) / 10,
        carbs: Math.round((acc.carbs + m.totals.carbs) * 10) / 10,
        fat: Math.round((acc.fat + m.totals.fat) * 10) / 10,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );

    return { ...day, meals, totals };
  });

  return { ...plan, days };
}
