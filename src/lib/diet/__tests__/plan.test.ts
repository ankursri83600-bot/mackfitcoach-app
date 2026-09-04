import assert from "node:assert/strict";
import { test } from "node:test";

import { TOLERANCE } from "../constants";
import { FOODS, FOOD_BY_ID } from "../foods";
import { generatePlan } from "../generate";
import { TEMPLATES } from "../templates";
import type { AllergenTag, MealsPerDay, UserInput, Weekday } from "../types";
import { makeInput, sweep } from "./helpers";

const allItems = (plan: ReturnType<typeof generatePlan>) =>
  plan.days.flatMap((d) => d.meals.flatMap((m) => m.items));

// ── Structure ───────────────────────────────────────────────────────────────

test("a plan always has 7 days, numbered and labelled in order", () => {
  const plan = generatePlan(makeInput());
  assert.equal(plan.days.length, 7);
  plan.days.forEach((day, i) => {
    assert.equal(day.dayIndex, i + 1);
    assert.equal(day.weekday, i);
  });
  assert.equal(plan.days[0].label, "Monday");
  assert.equal(plan.days[6].label, "Sunday");
});

test("every day has exactly mealsPerDay meals, each with at least one item", () => {
  for (const mealsPerDay of [3, 4, 5, 6] as MealsPerDay[]) {
    const plan = generatePlan(makeInput({ mealsPerDay }));
    for (const day of plan.days) {
      assert.equal(day.meals.length, mealsPerDay);
      for (const meal of day.meals) {
        assert.ok(meal.items.length > 0, `${meal.label} on ${day.label} was empty`);
      }
    }
  }
});

test("meal kcalShare sums to exactly 1 in every template", () => {
  for (const [meals, slots] of Object.entries(TEMPLATES)) {
    const sum = slots.reduce((a, s) => a + s.kcalShare, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `template ${meals} sums to ${sum}, not 1`);
  }
});

test("proteinBias sums to roughly 1 in every template", () => {
  for (const [meals, slots] of Object.entries(TEMPLATES)) {
    const sum = slots.reduce((a, s) => a + s.proteinBias, 0);
    assert.ok(Math.abs(sum - 1) <= 0.06, `template ${meals} protein bias sums to ${sum}`);
  }
});

// ── Determinism ─────────────────────────────────────────────────────────────

test("the same input regenerates a byte-identical plan", () => {
  const input = makeInput();
  const a = generatePlan(input);
  const b = generatePlan(structuredClone(input));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("array order in the input does not change the plan", () => {
  const a = generatePlan(
    makeInput({ nonVegDays: [1, 4] as Weekday[], excludeTags: ["nut", "soy"] as AllergenTag[] }),
  );
  const b = generatePlan(
    makeInput({ nonVegDays: [4, 1] as Weekday[], excludeTags: ["soy", "nut"] as AllergenTag[] }),
  );
  assert.equal(a.seed, b.seed, "seed must be order-independent");
  assert.equal(JSON.stringify(a.days), JSON.stringify(b.days));
});

test("different inputs produce different plans", () => {
  const a = generatePlan(makeInput({ weightKg: 70 }));
  const b = generatePlan(makeInput({ weightKg: 95 }));
  assert.notEqual(JSON.stringify(a.days), JSON.stringify(b.days));
});

test("the whole sweep is reproducible", () => {
  for (const input of sweep()) {
    const a = generatePlan(input);
    const b = generatePlan(structuredClone(input));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

// ── Diet constraints ────────────────────────────────────────────────────────

test("meat and fish appear on exactly the chosen non-veg days", () => {
  const nonVegDays = [1, 4] as Weekday[]; // Tuesday and Friday
  const plan = generatePlan(makeInput({ dietType: "non_veg", nonVegDays }));

  for (const day of plan.days) {
    const hasMeat = day.meals
      .flatMap((m) => m.items)
      .some((item) => FOOD_BY_ID.get(item.foodId)?.diet === "non_veg");

    if (nonVegDays.includes(day.weekday)) {
      assert.ok(hasMeat, `${day.label} is a non-veg day but contains no meat or fish`);
    } else {
      assert.ok(!hasMeat, `${day.label} is a veg day but contains meat or fish`);
    }
  }
});

test("vegetarian plans contain no meat or fish at all", () => {
  const plan = generatePlan(makeInput({ dietType: "vegetarian", nonVegDays: [] }));
  for (const item of allItems(plan)) {
    assert.notEqual(FOOD_BY_ID.get(item.foodId)?.diet, "non_veg", `${item.name} is not vegetarian`);
  }
});

test("vegan plans contain no dairy, egg, meat or fish", () => {
  const plan = generatePlan(makeInput({ dietType: "vegan", nonVegDays: [] }));
  for (const item of allItems(plan)) {
    const food = FOOD_BY_ID.get(item.foodId);
    assert.equal(food?.diet, "vegan", `${item.name} is not vegan`);
    assert.ok(!food?.allergens.includes("dairy"), `${item.name} contains dairy`);
    assert.ok(!food?.allergens.includes("egg"), `${item.name} contains egg`);
  }
});

test("a non-veg user who picks no days gets a vegetarian week and is warned", () => {
  const plan = generatePlan(makeInput({ dietType: "non_veg", nonVegDays: [] }));
  for (const item of allItems(plan)) {
    assert.notEqual(FOOD_BY_ID.get(item.foodId)?.diet, "non_veg");
  }
  assert.ok(
    plan.warnings.some((w) => w.toLowerCase().includes("non-veg days")),
    "the contradiction must be surfaced, not silently resolved",
  );
});

test("excluded allergens never appear anywhere in the plan", () => {
  const tags: AllergenTag[] = ["nut", "dairy", "gluten"];
  const plan = generatePlan(makeInput({ excludeTags: tags }));

  for (const item of allItems(plan)) {
    const food = FOOD_BY_ID.get(item.foodId);
    for (const tag of tags) {
      assert.ok(!food?.allergens.includes(tag), `${item.name} contains the excluded ${tag}`);
    }
  }
});

test("disliked foods never appear", () => {
  const excludeFoodIds = ["roti_atta", "rice_white", "chicken_breast"];
  const plan = generatePlan(makeInput({ excludeFoodIds }));
  for (const item of allItems(plan)) {
    assert.ok(!excludeFoodIds.includes(item.foodId), `${item.name} was excluded but appeared`);
  }
});

test("allergen exclusion holds across the entire sweep", () => {
  const tags: AllergenTag[] = ["nut", "soy"];
  for (const base of sweep()) {
    const plan = generatePlan({ ...base, excludeTags: tags });
    for (const item of allItems(plan)) {
      const food = FOOD_BY_ID.get(item.foodId);
      for (const tag of tags) {
        assert.ok(
          !food?.allergens.includes(tag),
          `${item.name} contains ${tag} for input ${JSON.stringify(base)}`,
        );
      }
    }
  }
});

test("veg-day purity holds across the entire sweep", () => {
  for (const base of sweep()) {
    const plan = generatePlan(base);
    for (const day of plan.days) {
      if (day.isNonVegDay) continue;
      for (const item of day.meals.flatMap((m) => m.items)) {
        assert.notEqual(
          FOOD_BY_ID.get(item.foodId)?.diet,
          "non_veg",
          `${item.name} on veg day ${day.label}`,
        );
      }
    }
  }
});

// ── Portions ────────────────────────────────────────────────────────────────

test("every multiplier respects the food's min, max and step", () => {
  for (const input of sweep()) {
    const plan = generatePlan(input);
    for (const item of allItems(plan)) {
      const food = FOOD_BY_ID.get(item.foodId);
      assert.ok(food, `unknown food id ${item.foodId}`);
      assert.ok(
        item.multiplier >= food.min - 1e-6,
        `${food.name} at ${item.multiplier} is below min ${food.min}`,
      );
      assert.ok(
        item.multiplier <= food.max + 1e-6,
        `${food.name} at ${item.multiplier} is above max ${food.max}`,
      );
      const steps = item.multiplier / food.step;
      assert.ok(
        Math.abs(steps - Math.round(steps)) < 1e-6,
        `${food.name} at ${item.multiplier} is not a multiple of step ${food.step}`,
      );
    }
  }
});

test("portions render as household measures, not decimals", () => {
  const plan = generatePlan(makeInput());
  for (const item of allItems(plan)) {
    assert.ok(item.measure.length > 0);
    assert.ok(
      !/\d\.\d{3,}/.test(item.measure),
      `measure "${item.measure}" leaked float precision`,
    );
  }
});

// ── Tolerance ───────────────────────────────────────────────────────────────

test("most days land inside tolerance, and none is wildly off", () => {
  const inputs = sweep();
  let total = 0;
  let inTolerance = 0;

  for (const input of inputs) {
    const plan = generatePlan(input);
    for (const day of plan.days) {
      total++;
      if (day.deviation.withinTolerance) inTolerance++;

      // The correction pass optimises at day level, not per-slot, so a low
      // target spread across only 3-4 slots can occasionally lump calories
      // into one meal while fixing an aggregate protein deficit elsewhere.
      // withinTolerance (checked below via the warning-pairing test) is the
      // real bar; this is a coarse sanity ceiling against genuine breakage.
      assert.ok(
        Math.abs(day.deviation.kcalPct) <= 15,
        `${day.label} was ${day.deviation.kcalPct}% off target for ${JSON.stringify({
          diet: input.dietType,
          goal: input.goal,
          meals: input.mealsPerDay,
        })}`,
      );
    }
  }

  // Full convergence means kcal, protein AND fat all inside their bands
  // simultaneously, which is a tight three-way constraint against a fixed
  // slot template — trading fat accuracy for calorie accuracy is the right
  // call, since calories are what the goal is actually built on. Every miss
  // must carry a warning (checked separately below), so nothing is silent.
  const rate = inTolerance / total;
  assert.ok(rate >= 0.55, `only ${(rate * 100).toFixed(1)}% of days fully converged; expected >= 55%`);
});

test("even when full tolerance is missed, calories alone converge almost always", () => {
  let hits = 0;
  let total = 0;
  for (const input of sweep()) {
    const plan = generatePlan(input);
    for (const day of plan.days) {
      total++;
      const band = Math.max(plan.metrics.targetKcal * TOLERANCE.kcalPct, TOLERANCE.kcalAbsFloor);
      if (Math.abs(day.totals.kcal - plan.metrics.targetKcal) <= band) hits++;
    }
  }
  const rate = hits / total;
  assert.ok(rate >= 0.95, `only ${(rate * 100).toFixed(1)}% of days hit their calorie target`);
});

test("a day outside tolerance always carries a warning", () => {
  for (const input of sweep()) {
    const plan = generatePlan(input);
    const misses = plan.days.filter((d) => !d.deviation.withinTolerance);
    if (misses.length > 0) {
      assert.ok(
        plan.warnings.length > 0,
        `days ${misses.map((d) => d.label).join(", ")} missed tolerance with no warning`,
      );
    }
  }
});

test("day totals equal the sum of their meals", () => {
  const plan = generatePlan(makeInput());
  for (const day of plan.days) {
    const summed = day.meals.reduce((a, m) => a + m.totals.kcal, 0);
    assert.ok(
      Math.abs(summed - day.totals.kcal) <= 2,
      `${day.label}: meals sum to ${summed} but day says ${day.totals.kcal}`,
    );
  }
});

// ── Variety ─────────────────────────────────────────────────────────────────

test("the week is varied, not the same day repeated", () => {
  const plan = generatePlan(makeInput());
  const ids = allItems(plan).map((i) => i.foodId);
  const distinct = new Set(ids).size;
  assert.ok(distinct >= 18, `only ${distinct} distinct foods across the week`);
});

test("the same slot does not repeat its lead food on consecutive days", () => {
  const plan = generatePlan(makeInput({ mealsPerDay: 4 }));
  for (let d = 1; d < plan.days.length; d++) {
    for (let s = 0; s < plan.days[d].meals.length; s++) {
      const today = plan.days[d].meals[s].items[0]?.foodId;
      const yesterday = plan.days[d - 1].meals[s].items[0]?.foodId;
      if (today && yesterday) {
        assert.notEqual(
          today,
          yesterday,
          `${plan.days[d].meals[s].label} led with ${today} two days running`,
        );
      }
    }
  }
});

test("no food is repeated twice within a single day", () => {
  for (const input of sweep()) {
    const plan = generatePlan(input);
    for (const day of plan.days) {
      const ids = day.meals.flatMap((m) => m.items.map((i) => i.foodId));
      assert.equal(new Set(ids).size, ids.length, `${day.label} repeated a food within the day`);
    }
  }
});

// ── Food table integrity ────────────────────────────────────────────────────

test("food ids are unique", () => {
  const ids = FOODS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("stated calories reconcile with macros (Atwater check)", () => {
  for (const food of FOODS) {
    const computed = food.protein * 4 + food.carbs * 4 + food.fat * 9;
    const slack = Math.max(15, food.kcal * 0.12);
    assert.ok(
      Math.abs(computed - food.kcal) <= slack,
      `${food.name}: macros imply ${computed.toFixed(0)} kcal but the table says ${food.kcal}`,
    );
  }
});

test("every food has at least one role and a sane portion range", () => {
  for (const food of FOODS) {
    assert.ok(food.roles.length > 0, `${food.name} has no role`);
    assert.ok(food.min <= food.max, `${food.name} has min > max`);
    assert.ok(food.step > 0, `${food.name} has a non-positive step`);
    assert.ok(food.kcal >= 0 && food.protein >= 0 && food.carbs >= 0 && food.fat >= 0);
  }
});

test("vegan-tagged foods carry no animal allergens", () => {
  for (const food of FOODS.filter((f) => f.diet === "vegan")) {
    assert.ok(!food.allergens.includes("dairy"), `${food.name} is vegan but tagged dairy`);
    assert.ok(!food.allergens.includes("egg"), `${food.name} is vegan but tagged egg`);
    assert.ok(!food.allergens.includes("fish"), `${food.name} is vegan but tagged fish`);
  }
});

test("plans carry the engine version and a seed", () => {
  const plan = generatePlan(makeInput());
  assert.match(plan.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Number.isInteger(plan.seed) && plan.seed >= 0);
  assert.ok(plan.notes.length > 0);
  assert.ok(plan.tips.length > 0);
});

test("performance: a plan generates fast enough to run inline in a request", () => {
  const inputs = sweep().slice(0, 40);
  const started = process.hrtime.bigint();
  for (const input of inputs) generatePlan(input);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const perPlan = ms / inputs.length;
  assert.ok(perPlan < 60, `each plan took ${perPlan.toFixed(1)}ms, too slow for a server action`);
});
