import { GOAL_LABEL, KCAL_FLOOR, WEEKDAY_LABEL } from "./constants";
import type { BmiCategoryAsian, Metrics, PlanDay, UserInput } from "./types";

const ASIAN_LABEL: Record<BmiCategoryAsian, string> = {
  underweight: "underweight",
  normal: "in the healthy range",
  overweight: "overweight",
  obese: "in the obese range",
};

/**
 * The human layer of the plan: what the numbers mean, what the engine had to
 * compromise on, and how to actually follow the chart.
 */
export function buildNotes(
  input: UserInput,
  metrics: Metrics,
  days: readonly PlanDay[],
): { notes: string[]; tips: string[] } {
  const notes: string[] = [];
  const tips: string[] = [];

  // BMI, on both scales, because they disagree for Indian bodies and that
  // difference changes the advice.
  notes.push(
    `Your BMI is ${metrics.bmi}. On the WHO international scale that is ` +
      `${metrics.bmiCategoryWho.replace(/_/g, " ")}; on the Asian-Indian scale used by the ICMR ` +
      `— where overweight begins at 23 rather than 25 — you are ${ASIAN_LABEL[metrics.bmiCategoryAsian]}. ` +
      `We plan against the Asian-Indian scale.`,
  );

  notes.push(
    `At rest your body burns about ${metrics.bmr} kcal a day. With your activity level that comes ` +
      `to roughly ${metrics.tdee} kcal. Your target for ${GOAL_LABEL[input.goal].toLowerCase()} is ` +
      `${metrics.targetKcal} kcal a day, split as ${metrics.macros.proteinG}g protein, ` +
      `${metrics.macros.carbsG}g carbs and ${metrics.macros.fatG}g fat.`,
  );

  if (metrics.appliedFloor) {
    notes.push(
      `Your calculated deficit would have pushed you below ${KCAL_FLOOR[input.gender]} kcal, ` +
        `so the target has been raised to that floor. Eating less than this is not safe to do ` +
        `unsupervised, and it costs you muscle rather than fat.`,
    );
  }

  if (metrics.projectedWeeklyKg !== 0) {
    const direction = metrics.projectedWeeklyKg < 0 ? "lose" : "gain";
    const rate = Math.abs(metrics.projectedWeeklyKg);
    notes.push(
      `At this intake you should ${direction} roughly ${rate} kg a week. That is a straight-line ` +
        `estimate — as your weight changes your body burns less, so expect the rate to slow. ` +
        `Recalculate every four weeks.`,
    );
  }

  if (metrics.timeline.weeksRealistic > 0) {
    notes.push(
      `A body weight of ${metrics.timeline.targetWeightKg} kg would put you mid-healthy-range for ` +
        `your height, about ${Math.abs(metrics.timeline.deltaKg)} kg from where you are now. ` +
        `Allowing for real-world adherence, that is roughly ${metrics.timeline.weeksRealistic} weeks.`,
    );
  }

  // Diet-rule confirmation, so the user can see their choice was respected.
  if (input.dietType === "non_veg" && input.nonVegDays.length > 0) {
    const dayNames = input.nonVegDays.map((d) => WEEKDAY_LABEL[d]);
    const nonVegCount = days.filter((d) => d.isNonVegDay).length;
    notes.push(
      `Meat and fish appear only on ${listify(dayNames)} — ${nonVegCount} of the 7 days. ` +
        `Every other day is built from vegetarian food.`,
    );
  } else if (input.dietType === "vegan") {
    notes.push(
      `This is a fully vegan plan: no dairy, no eggs, no honey. Your protein target has been ` +
        `raised about 10% because plant proteins are absorbed slightly less efficiently.`,
    );
  } else if (input.dietType === "vegetarian") {
    notes.push(`This is a vegetarian plan. Dairy and eggs are included; meat and fish are not.`);
  }

  if (input.excludeTags.length > 0) {
    notes.push(`Every food containing ${listify([...input.excludeTags])} has been excluded.`);
  }

  notes.push(
    `Drink about ${(metrics.waterMl / 1000).toFixed(1)} litres of water a day, spread through the ` +
      `day rather than all at once.`,
  );

  tips.push(
    "Portions are given in household measures — katori, roti, tsp — because a kitchen scale you do not own is useless. One katori is a standard Indian steel bowl, roughly 150 ml.",
    "Dal, rice and dalia quantities are DRY weight, measured before cooking.",
    "Swap any vegetable for another green vegetable freely. Swapping a protein for a carb is what breaks a plan.",
    "Keep the meal times roughly consistent day to day. Your appetite adapts to a schedule faster than to a calorie count.",
    "Weigh yourself once a week, same day, first thing in the morning, after using the toilet and before eating. Daily weighing measures water, not fat.",
    "If a day feels genuinely too heavy or too light, tell your coach on the check-in call rather than silently abandoning the plan.",
  );

  if (input.goal === "muscle_gain") {
    tips.push(
      "Muscle is built by progressive overload, not by calories alone. If the weight on the bar is not going up over a month, the food is not the problem.",
    );
  }
  if (input.goal === "fat_loss") {
    tips.push(
      "Protein and vegetables first at every meal. They are what keep you full on a deficit.",
    );
  }

  return { notes, tips };
}

function listify(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
