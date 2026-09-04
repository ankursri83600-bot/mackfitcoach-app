import assert from "node:assert/strict";
import { test } from "node:test";

import { KCAL_FLOOR } from "../constants";
import {
  bmi,
  bmiCategoryAsian,
  bmiCategoryWho,
  bmr,
  computeMetrics,
  macroSplit,
  targetCalories,
  tdee,
  validateAndClamp,
  waterMl,
} from "../metrics";
import { InvalidInputError } from "../types";
import { makeInput } from "./helpers";

test("BMI matches hand-worked values", () => {
  assert.equal(bmi(80, 175), 26.1);
  assert.equal(bmi(60, 165), 22.0);
  assert.equal(bmi(45, 160), 17.6);
});

test("WHO BMI boundaries are exact at the cutoffs", () => {
  assert.equal(bmiCategoryWho(18.4), "underweight");
  assert.equal(bmiCategoryWho(18.5), "normal");
  assert.equal(bmiCategoryWho(24.9), "normal");
  assert.equal(bmiCategoryWho(25), "overweight");
  assert.equal(bmiCategoryWho(29.9), "overweight");
  assert.equal(bmiCategoryWho(30), "obese_1");
  assert.equal(bmiCategoryWho(35), "obese_2");
  assert.equal(bmiCategoryWho(40), "obese_3");
});

test("Asian-Indian BMI cutoffs sit at 23 and 25, not 25 and 30", () => {
  assert.equal(bmiCategoryAsian(22.9), "normal");
  assert.equal(bmiCategoryAsian(23), "overweight");
  assert.equal(bmiCategoryAsian(24.9), "overweight");
  assert.equal(bmiCategoryAsian(25), "obese");
});

test("Mifflin-St Jeor BMR matches hand calculation", () => {
  // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 -> 1749
  assert.equal(bmr({ weightKg: 80, heightCm: 175, age: 30, gender: "male" }), 1749);
  // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
  assert.equal(bmr({ weightKg: 60, heightCm: 165, age: 28, gender: "female" }), 1330);
});

test("TDEE applies the activity multiplier", () => {
  assert.equal(tdee(1749, "sedentary"), Math.round(1749 * 1.2));
  assert.equal(tdee(1749, "athlete"), Math.round(1749 * 1.9));
});

test("calorie floor overrides an unsafe deficit and is flagged", () => {
  // Small sedentary female on fat loss: TDEE is low enough that -20% breaches 1200.
  const input = makeInput({
    gender: "female",
    age: 45,
    heightCm: 152,
    weightKg: 45,
    activityLevel: "sedentary",
    goal: "fat_loss",
    dietType: "vegetarian",
    nonVegDays: [],
  });
  const m = computeMetrics(input);

  assert.equal(m.targetKcal, KCAL_FLOOR.female);
  assert.equal(m.appliedFloor, true, "the floor must be reported, not applied silently");
});

test("male floor is respected too", () => {
  const { targetKcal, appliedFloor } = targetCalories(1400, "fat_loss", "male");
  assert.equal(targetKcal, KCAL_FLOOR.male);
  assert.equal(appliedFloor, true);
});

test("maintenance target equals TDEE and applies no floor flag", () => {
  const { targetKcal, appliedFloor } = targetCalories(2400, "maintenance", "male");
  assert.equal(targetKcal, 2400);
  assert.equal(appliedFloor, false);
});

test("deficit is clamped to an absolute maximum", () => {
  // 20% of 5000 is 1000, which exceeds the 750 kcal cap.
  const { targetKcal } = targetCalories(5000, "fat_loss", "male");
  assert.equal(targetKcal, 4250);
});

test("macro split keeps carbs at or above the practical minimum", () => {
  const input = makeInput({ gender: "female", weightKg: 90, heightCm: 155, goal: "fat_loss" });
  const macros = macroSplit(1200, input, bmi(90, 155));

  assert.ok(macros.carbsG >= 100, `carbs were ${macros.carbsG}, expected >= 100`);
  assert.ok(macros.proteinG > 0);
  assert.ok(macros.fatG > 0);
});

test("macro split energy reconciles with the calorie target", () => {
  const input = makeInput();
  const kcal = 2200;
  const m = macroSplit(kcal, input, bmi(input.weightKg, input.heightCm));
  const fromMacros = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;

  // Integer rounding of three macros can drift a few kcal; more than 30 is a bug.
  assert.ok(
    Math.abs(fromMacros - kcal) <= 30,
    `macros sum to ${fromMacros} kcal against a ${kcal} target`,
  );
});

test("protein never exceeds 40% of energy", () => {
  const input = makeInput({ weightKg: 120, heightCm: 165, goal: "fat_loss" });
  const kcal = 1600;
  const m = macroSplit(kcal, input, bmi(120, 165));
  assert.ok((m.proteinG * 4) / kcal <= 0.4 + 1e-9);
});

test("vegan protein target is uplifted above the same non-vegan input", () => {
  const base = makeInput({ dietType: "vegetarian", nonVegDays: [] });
  const vegan = makeInput({ dietType: "vegan", nonVegDays: [] });
  const b = macroSplit(2200, base, bmi(base.weightKg, base.heightCm));
  const v = macroSplit(2200, vegan, bmi(vegan.weightKg, vegan.heightCm));
  assert.ok(v.proteinG > b.proteinG);
});

test("water target scales with weight and activity, and is capped", () => {
  assert.equal(waterMl(makeInput({ weightKg: 80, activityLevel: "sedentary" })), 2800);
  assert.ok(waterMl(makeInput({ weightKg: 80, activityLevel: "athlete" })) > 2800);
  assert.ok(waterMl(makeInput({ weightKg: 200, activityLevel: "athlete" })) <= 4500);
});

test("fat loss projects weight loss, muscle gain projects gain", () => {
  const loss = computeMetrics(makeInput({ goal: "fat_loss" }));
  const gain = computeMetrics(makeInput({ goal: "muscle_gain" }));
  const maintain = computeMetrics(makeInput({ goal: "maintenance" }));

  assert.ok(loss.projectedWeeklyKg < 0);
  assert.ok(gain.projectedWeeklyKg > 0);
  assert.equal(maintain.projectedWeeklyKg, 0);
});

test("under-age input is rejected rather than clamped", () => {
  assert.throws(() => validateAndClamp(makeInput({ age: 12 })), InvalidInputError);
});

test("implausible height and weight are rejected", () => {
  assert.throws(() => validateAndClamp(makeInput({ heightCm: 90 })), InvalidInputError);
  assert.throws(() => validateAndClamp(makeInput({ weightKg: 500 })), InvalidInputError);
});

test("nonVegDays is cleared for non-meat diets and normalised otherwise", () => {
  const veg = validateAndClamp(makeInput({ dietType: "vegetarian", nonVegDays: [1, 2] }));
  assert.deepEqual(veg.nonVegDays, [], "a vegetarian cannot have non-veg days");

  const nv = validateAndClamp(makeInput({ dietType: "non_veg", nonVegDays: [5, 1, 5, 1] }));
  assert.deepEqual(nv.nonVegDays, [1, 5], "days must be deduped and sorted");
});
