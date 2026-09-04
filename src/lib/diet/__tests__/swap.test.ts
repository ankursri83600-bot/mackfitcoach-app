import assert from "node:assert/strict";
import test from "node:test";

import { FOOD_BY_ID } from "../foods";
import { generatePlan } from "../generate";
import { applySwaps, findSwaps, type StoredSwap } from "../swap";
import { makeInput } from "./helpers";

/** First item of the first meal of day 1 — a stable target for most tests. */
function firstItem(plan: ReturnType<typeof generatePlan>) {
  const day = plan.days[0];
  const meal = day.meals[0];
  return { day, meal, item: meal.items[0] };
}

test("candidates share a role with the food they replace", () => {
  const plan = generatePlan(makeInput());
  const { day, meal, item } = firstItem(plan);

  const original = FOOD_BY_ID.get(item.foodId)!;
  const candidates = findSwaps(plan, day.dayIndex, meal.slotId, item.foodId);

  assert.ok(candidates.length > 0, "expected at least one substitute");
  for (const c of candidates) {
    const food = FOOD_BY_ID.get(c.foodId)!;
    assert.ok(
      food.roles.some((r) => original.roles.includes(r)),
      `${food.name} shares no role with ${original.name}`,
    );
  }
});

test("a swap never introduces an excluded allergen", () => {
  // Someone who cannot have dairy or nuts.
  const plan = generatePlan(makeInput({ excludeTags: ["dairy", "nut"] }));

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        for (const c of findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)) {
          const food = FOOD_BY_ID.get(c.foodId)!;
          assert.ok(
            !food.allergens.includes("dairy") && !food.allergens.includes("nut"),
            `${food.name} carries an excluded allergen`,
          );
        }
      }
    }
  }
});

test("a vegan plan is never offered a non-vegan substitute", () => {
  const plan = generatePlan(makeInput({ dietType: "vegan" }));

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        for (const c of findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)) {
          assert.equal(FOOD_BY_ID.get(c.foodId)!.diet, "vegan", `${c.name} is not vegan`);
        }
      }
    }
  }
});

test("meat is never offered on a day the user did not pick for it", () => {
  const plan = generatePlan(makeInput({ dietType: "non_veg", nonVegDays: [2] }));

  for (const day of plan.days) {
    if (day.isNonVegDay) continue;
    for (const meal of day.meals) {
      for (const item of meal.items) {
        for (const c of findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)) {
          assert.notEqual(
            FOOD_BY_ID.get(c.foodId)!.diet,
            "non_veg",
            `${c.name} offered on veg day ${day.dayIndex}`,
          );
        }
      }
    }
  }
});

test("a candidate is never something already in the same meal", () => {
  const plan = generatePlan(makeInput());
  const { day, meal, item } = firstItem(plan);

  const present = new Set(meal.items.map((i) => i.foodId));
  for (const c of findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)) {
    assert.ok(!present.has(c.foodId), `${c.name} is already in this meal`);
  }
});

test("substitutes land within 35% of the calories they replace", () => {
  const plan = generatePlan(makeInput());
  const { day, meal, item } = firstItem(plan);

  for (const c of findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)) {
    const drift = Math.abs(c.kcal - item.kcal) / item.kcal;
    assert.ok(drift <= 0.36, `${c.name}: ${c.kcal} vs ${item.kcal} kcal`);
  }
});

test("applying a swap replaces the item and re-totals meal and day", () => {
  const plan = generatePlan(makeInput());
  const { day, meal, item } = firstItem(plan);
  const target = findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)[0];

  const swaps: StoredSwap[] = [
    { dayIndex: day.dayIndex, slotId: meal.slotId, fromFoodId: item.foodId, toFoodId: target.foodId },
  ];
  const next = applySwaps(plan, swaps);

  const nextMeal = next.days[0].meals[0];
  assert.ok(!nextMeal.items.some((i) => i.foodId === item.foodId), "old item still present");
  assert.ok(nextMeal.items.some((i) => i.foodId === target.foodId), "new item missing");

  // Meal totals equal the sum of its items.
  const sum = nextMeal.items.reduce((s, i) => s + i.kcal, 0);
  assert.equal(nextMeal.totals.kcal, sum);

  // Day totals equal the sum of its meals.
  const daySum = next.days[0].meals.reduce((s, m) => s + m.totals.kcal, 0);
  assert.equal(next.days[0].totals.kcal, daySum);
});

test("applying no swaps returns the plan untouched", () => {
  const plan = generatePlan(makeInput());
  assert.equal(applySwaps(plan, []), plan);
});

test("untouched days keep their identity, so React can skip them", () => {
  const plan = generatePlan(makeInput());
  const { day, meal, item } = firstItem(plan);
  const target = findSwaps(plan, day.dayIndex, meal.slotId, item.foodId)[0];

  const next = applySwaps(plan, [
    { dayIndex: 1, slotId: meal.slotId, fromFoodId: item.foodId, toFoodId: target.foodId },
  ]);

  assert.notEqual(next.days[0], plan.days[0], "day 1 should be a new object");
  for (let i = 1; i < plan.days.length; i++) {
    assert.equal(next.days[i], plan.days[i], `day ${i + 1} should be reused`);
  }
});

test("a swap referencing a food that no longer exists is ignored, not crashed on", () => {
  const plan = generatePlan(makeInput());
  const { meal, item } = firstItem(plan);

  const next = applySwaps(plan, [
    { dayIndex: 1, slotId: meal.slotId, fromFoodId: item.foodId, toFoodId: "food-that-was-deleted" },
  ]);

  assert.deepEqual(next.days[0].meals[0].items[0], item);
});

test("swapping is deterministic", () => {
  const a = generatePlan(makeInput());
  const b = generatePlan(makeInput());
  const { day, meal, item } = firstItem(a);

  assert.deepEqual(
    findSwaps(a, day.dayIndex, meal.slotId, item.foodId),
    findSwaps(b, day.dayIndex, meal.slotId, item.foodId),
  );
});
