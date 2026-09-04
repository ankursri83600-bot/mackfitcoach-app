import { ENGINE_VERSION, TOLERANCE, WEEKDAY_LABEL } from "./constants";
import { formatPortion } from "./foods";
import { buildNotes } from "./notes";
import { computeMetrics, validateAndClamp } from "./metrics";
import { offsetFor, pickWithProbe, seedFor } from "./rotation";
import { buildPool, highestHeadroom, meatSubset, proteinDense, type Pool } from "./select";
import {
  clampToStep,
  correctDay,
  cost,
  dayTotals,
  mealTotals,
  scaleSlot,
  worstSlotIndex,
  type MacroTarget,
  type MutableMeal,
} from "./scale";
import { TEMPLATES, type Slot } from "./templates";
import type {
  DietPlan,
  Food,
  Metrics,
  PlanDay,
  PlanItem,
  PlanMeal,
  Totals,
  UserInput,
  Weekday,
} from "./types";

const round = (v: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

interface BuildDayArgs {
  seed: number;
  dayIndex: number;
  weekday: Weekday;
  isNonVegDay: boolean;
  pool: Pool;
  slots: readonly Slot[];
  target: MacroTarget;
  /** Food id used in each slot on the previous day, to avoid same-slot repeats. */
  previousBySlot: readonly (string | null)[];
}

/** Choose the foods for one slot, before any portion scaling. */
function chooseSlotFoods(
  args: BuildDayArgs,
  slot: Slot,
  slotIndex: number,
  usedToday: Set<string>,
): Food[] {
  const { seed, dayIndex, pool, isNonVegDay, previousBySlot } = args;
  const chosen: Food[] = [];
  let slotHasCookingFat = false;

  slot.roles.forEach((role, roleIndex) => {
    // On a meat day, bias the protein role toward the meat sub-pool so the
    // user's non-veg days actually contain meat rather than merely permitting it.
    const preferMeat = role === "protein" && isNonVegDay && slot.allowMeat;
    const candidates = preferMeat ? meatSubset(pool, role) : (pool.get(role) ?? []);
    const fallback = pool.get(role) ?? [];
    const usePool = candidates.length > 0 ? candidates : fallback;

    const start = offsetFor(seed, dayIndex, slotIndex, roleIndex, usePool.length);

    // A composed dish already carries its cooking oil; adding ghee on top would
    // double-count the fat. This constraint is never relaxed.
    const fatConflict = (food: Food) => role === "fat" && slotHasCookingFat;

    // Tiered relaxation. Never duplicate within a day — that is the one rule
    // worth failing a role over.
    const picked =
      pickWithProbe(
        usePool,
        start,
        (food) => usedToday.has(food.id) || previousBySlot[slotIndex] === food.id || fatConflict(food),
      ) ??
      // Fall back to allowing the same food this slot had yesterday.
      pickWithProbe(usePool, start, (food) => usedToday.has(food.id) || fatConflict(food)) ??
      // Last resort: widen to the unrestricted pool for this role.
      pickWithProbe(fallback, 0, (food) => usedToday.has(food.id) || fatConflict(food));

    if (!picked) return;
    if (picked.includesCookingFat) slotHasCookingFat = true;
    usedToday.add(picked.id);
    chosen.push(picked);
  });

  return chosen;
}

function buildDay(args: BuildDayArgs): { day: PlanDay; warnings: string[] } {
  const { slots, target, pool } = args;
  const warnings: string[] = [];
  const usedToday = new Set<string>();

  const meals: MutableMeal[] = slots.map((slot, slotIndex) => {
    const foods = chooseSlotFoods(args, slot, slotIndex, usedToday);
    const slotKcal = target.kcal * slot.kcalShare;
    return {
      slotId: slot.id,
      foods,
      multipliers: scaleSlot(foods, slotKcal),
      targetKcal: slotKcal,
    };
  });

  let result = correctDay(meals, target);

  /**
   * Structural repair.
   *
   * The descent can only resize what is already on the plate, so it stalls in
   * two distinct ways and each needs a different fix:
   *
   *  - CALORIE SHORTFALL. Every item is at its maximum portion and the day still
   *    cannot reach the target. This is what a vegan 3-meal fat-loss plan hits:
   *    with no dairy in the pool and only three slots, the ceiling sits well
   *    below the goal. Fix by ADDING a calorie-dense item to the hungriest slot.
   *  - PROTEIN SHORTFALL. Calories are fine but protein is short, so SWAP the
   *    least protein-dense item for the densest unused protein source.
   *
   * Both are bounded by maxStructuralRepairs, so neither can spin.
   */
  // Repair is only allowed to help. Adding a calorie-dense filler can overshoot
  // — and once every item sits at its minimum the descent cannot come back down
  // — so each attempt is scored and the best state is restored at the end.
  const snapshot = () =>
    meals.map((m) => ({ foods: [...m.foods], multipliers: [...m.multipliers] }));
  let bestCost = cost(result.totals, target);
  let bestState = snapshot();
  let bestResult = result;

  let repairs = 0;
  while (!result.converged && repairs < TOLERANCE.maxStructuralRepairs) {
    repairs++;

    const kcalBand = Math.max(target.kcal * TOLERANCE.kcalPct, TOLERANCE.kcalAbsFloor);
    const kcalShort = target.kcal - result.totals.kcal > kcalBand;
    const proteinShort = result.totals.protein < target.protein * TOLERANCE.proteinMinPct;

    if (kcalShort) {
      // Add to the slot with the largest absolute calorie deficit.
      let hungriest = 0;
      let worstGap = -Infinity;
      for (let i = 0; i < meals.length; i++) {
        const gap = meals[i].targetKcal - mealTotals(meals[i]).kcal;
        if (gap > worstGap) {
          worstGap = gap;
          hungriest = i;
        }
      }

      // Prefer protein when protein is also short, otherwise favour staples.
      const roles = proteinShort
        ? (["protein", "carb", "fat"] as const)
        : (["carb", "fat", "protein"] as const);
      const filler = highestHeadroom(pool, roles, usedToday);
      if (!filler) break;

      usedToday.add(filler.id);
      meals[hungriest].foods.push(filler);
      meals[hungriest].multipliers.push(clampToStep(filler.min, filler));
    } else if (proteinShort) {
      const slotIdx = worstSlotIndex(meals);
      const meal = meals[slotIdx];
      if (meal.foods.length === 0) break;

      let weakest = 0;
      for (let i = 1; i < meal.foods.length; i++) {
        const d = meal.foods[i].protein / Math.max(meal.foods[i].kcal, 1);
        const w = meal.foods[weakest].protein / Math.max(meal.foods[weakest].kcal, 1);
        if (d < w) weakest = i;
      }

      const replacement = proteinDense(pool, usedToday);
      if (!replacement) break;

      usedToday.delete(meal.foods[weakest].id);
      usedToday.add(replacement.id);
      meal.foods[weakest] = replacement;
      meal.multipliers[weakest] = clampToStep(replacement.min, replacement);
    } else if (result.totals.kcal - target.kcal > kcalBand) {
      // OVER target with everything already at its minimum portion. A low
      // fat-loss target across only three slots can sit below the combined
      // minimum of what is on the plate, so the only move left is to take
      // something off it.
      //
      // Choosing purely by cost is actively harmful, and was: because excess
      // protein carries a small penalty, the cheapest removal was often the
      // cabbage, the dal or the apple. That produced a "mid-morning" of three
      // teaspoons of coconut oil and a dinner of rice and olive oil. Removal is
      // therefore restricted to accessory items, and a slot may never lose its
      // only protein, vegetable or fruit.
      const REMOVABLE_ROLES = new Set(["fat", "drink", "snack"]);

      const isStructural = (meal: MutableMeal, index: number): boolean => {
        const food = meal.foods[index];
        for (const role of ["protein", "veg", "fruit"] as const) {
          if (!food.roles.includes(role)) continue;
          const others = meal.foods.filter((f, i) => i !== index && f.roles.includes(role));
          if (others.length === 0) return true;
        }
        return false;
      };

      let bestRemoval: { meal: number; item: number; cost: number } | null = null;

      for (let m = 0; m < meals.length; m++) {
        if (meals[m].foods.length <= 1) continue;
        for (let i = 0; i < meals[m].foods.length; i++) {
          const food = meals[m].foods[i];
          if (!food.roles.some((r) => REMOVABLE_ROLES.has(r))) continue;
          if (isStructural(meals[m], i)) continue;

          const mult = meals[m].multipliers[i];
          const without = {
            kcal: result.totals.kcal - food.kcal * mult,
            protein: result.totals.protein - food.protein * mult,
            carbs: result.totals.carbs - food.carbs * mult,
            fat: result.totals.fat - food.fat * mult,
          };
          // Never swing the day from over-target to under-target.
          if (without.kcal < target.kcal - kcalBand) continue;

          const scored = cost(without, target);
          if (bestRemoval === null || scored < bestRemoval.cost) {
            bestRemoval = { meal: m, item: i, cost: scored };
          }
        }
      }

      if (!bestRemoval) break;

      const meal = meals[bestRemoval.meal];
      usedToday.delete(meal.foods[bestRemoval.item].id);
      meal.foods.splice(bestRemoval.item, 1);
      meal.multipliers.splice(bestRemoval.item, 1);
    } else {
      // Inside the calorie band but another macro is out of tolerance. Nothing
      // structural left to do — the descent has already minimised it and the
      // deviation is reported to the user as a warning.
      break;
    }

    result = correctDay(meals, target);

    const scored = cost(result.totals, target);
    if (scored < bestCost) {
      bestCost = scored;
      bestState = snapshot();
      bestResult = result;
    }
  }

  // Roll back to the best state seen, so a repair attempt can never leave the
  // day worse than before it ran.
  if (result !== bestResult) {
    meals.forEach((meal, i) => {
      meal.foods = bestState[i].foods;
      meal.multipliers = bestState[i].multipliers;
    });
    result = bestResult;
  }

  // Every unconverged day must say so — a silently-short plan is worse than an
  // honest one, and the tests assert this pairing holds.
  if (!result.converged) {
    const day = WEEKDAY_LABEL[args.weekday];
    const proteinGap = Math.round(target.protein - result.totals.protein);
    const kcalGap = Math.round(target.kcal - result.totals.kcal);
    const fatGap = Math.round(result.totals.fat - target.fat);
    const fatBand = target.fat * TOLERANCE.fatPct;

    if (Math.abs(fatGap) > fatBand) {
      warnings.push(
        fatGap > 0
          ? `${day}: fat runs about ${fatGap}g over target — the calorie and protein targets took ` +
            `priority in the food choices available. Trim visible oil or ghee if you want to tighten it.`
          : `${day}: fat lands about ${Math.abs(fatGap)}g under target. A teaspoon of ghee or a ` +
            `few nuts would close the gap without moving the calorie count much.`,
      );
    }

    if (proteinGap > 0) {
      warnings.push(
        `${day}: protein lands about ${proteinGap}g under target. Adding a scoop of plant or ` +
          `whey protein would close the gap.`,
      );
    }
    if (Math.abs(kcalGap) > 0) {
      warnings.push(
        kcalGap > 0
          ? `${day}: this day comes to about ${kcalGap} kcal under target — the food choices ` +
            `available under your restrictions cap out below your goal. Consider more meals a day.`
          : `${day}: this day runs about ${Math.abs(kcalGap)} kcal over target. Reduce the ` +
            `largest carb portion if you want to land exactly on it.`,
      );
    }
  }

  const planMeals: PlanMeal[] = meals.map((meal, i) => {
    const slot = slots[i];
    const items: PlanItem[] = meal.foods.map((food, idx) => {
      const multiplier = meal.multipliers[idx];
      return {
        foodId: food.id,
        name: food.name,
        measure: formatPortion(food, multiplier),
        qty: round(food.base.qty * multiplier, 1),
        unit: food.base.unit,
        multiplier,
        kcal: Math.round(food.kcal * multiplier),
        protein: round(food.protein * multiplier, 1),
        carbs: round(food.carbs * multiplier, 1),
        fat: round(food.fat * multiplier, 1),
      };
    });

    const t = mealTotals(meal);
    return {
      slotId: slot.id,
      label: slot.label,
      timeHint: slot.timeHint,
      targetKcal: Math.round(meal.targetKcal),
      items,
      totals: roundTotals(t),
    };
  });

  const totals = dayTotals(meals);

  return {
    day: {
      dayIndex: args.dayIndex + 1,
      weekday: args.weekday,
      label: WEEKDAY_LABEL[args.weekday],
      isNonVegDay: args.isNonVegDay,
      meals: planMeals,
      totals: roundTotals(totals),
      deviation: {
        kcalPct: round(((totals.kcal - target.kcal) / target.kcal) * 100, 1),
        proteinPct: round(((totals.protein - target.protein) / target.protein) * 100, 1),
        withinTolerance: result.converged,
      },
    },
    warnings,
  };
}

function roundTotals(t: Totals): Totals {
  return {
    kcal: Math.round(t.kcal),
    protein: round(t.protein, 1),
    carbs: round(t.carbs, 1),
    fat: round(t.fat, 1),
  };
}

function average(list: readonly Totals[]): Totals {
  if (list.length === 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const sum = list.reduce(
    (a, t) => ({
      kcal: a.kcal + t.kcal,
      protein: a.protein + t.protein,
      carbs: a.carbs + t.carbs,
      fat: a.fat + t.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: Math.round(sum.kcal / list.length),
    protein: round(sum.protein / list.length, 1),
    carbs: round(sum.carbs / list.length, 1),
    fat: round(sum.fat / list.length, 1),
  };
}

/**
 * Generates a full 7-day plan.
 *
 * Pure and synchronous — safe to call directly inside a Server Action or a
 * Server Component with no caching layer.
 */
export function generatePlan(rawInput: UserInput): DietPlan {
  const input = validateAndClamp(rawInput);
  const metrics: Metrics = computeMetrics(input);
  const seed = seedFor(input);

  const warnings: string[] = [];

  // A non-veg user who picked no days effectively eats vegetarian. Say so
  // rather than silently producing a plan that contradicts their choice.
  if (input.dietType === "non_veg" && input.nonVegDays.length === 0) {
    warnings.push(
      "You chose non-veg but did not pick any non-veg days, so this week is built entirely from vegetarian food. Pick your days to see meat and fish in the plan.",
    );
  }

  const vegPool = buildPool(input, false);
  const meatPool =
    input.dietType === "non_veg" && input.nonVegDays.length > 0
      ? buildPool(input, true)
      : vegPool;

  const slots = TEMPLATES[input.mealsPerDay];
  const target: MacroTarget = {
    kcal: metrics.targetKcal,
    protein: metrics.macros.proteinG,
    carbs: metrics.macros.carbsG,
    fat: metrics.macros.fatG,
  };

  const days: PlanDay[] = [];
  let previousBySlot: (string | null)[] = slots.map(() => null);

  for (let d = 0; d < 7; d++) {
    const weekday = d as Weekday;
    const isNonVegDay = input.dietType === "non_veg" && input.nonVegDays.includes(weekday);

    const { day, warnings: dayWarnings } = buildDay({
      seed,
      dayIndex: d,
      weekday,
      isNonVegDay,
      pool: isNonVegDay ? meatPool : vegPool,
      slots,
      target,
      previousBySlot,
    });

    previousBySlot = day.meals.map((m) => m.items[0]?.foodId ?? null);
    warnings.push(...dayWarnings);
    days.push(day);
  }

  const { notes, tips } = buildNotes(input, metrics, days);

  return {
    version: ENGINE_VERSION,
    seed,
    input,
    metrics,
    days,
    weekAverages: average(days.map((d) => d.totals)),
    notes,
    tips,
    warnings,
  };
}
