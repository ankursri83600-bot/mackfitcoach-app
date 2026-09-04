import assert from "node:assert/strict";
import test from "node:test";

import { buildShoppingList, shoppingListText } from "../shopping";
import { generatePlan } from "../generate";
import { makeInput } from "./helpers";

const plan = generatePlan(makeInput());

test("every plan item reaches the list exactly once per food", () => {
  const list = buildShoppingList(plan);

  const distinctFoods = new Set(
    plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId))),
  );

  assert.equal(list.totalItems, distinctFoods.size);
  assert.equal(new Set(list.lines.map((l) => l.foodId)).size, list.lines.length);
});

test("quantities are the exact sum of the plan, not rounded to pack sizes", () => {
  const list = buildShoppingList(plan);

  for (const line of list.lines) {
    const expected = plan.days
      .flatMap((d) => d.meals.flatMap((m) => m.items))
      .filter((i) => i.foodId === line.foodId)
      .reduce((sum, i) => sum + i.qty, 0);

    // The stored qty is rounded to one decimal for display only.
    assert.ok(
      Math.abs(line.qty - expected) < 0.11,
      `${line.name}: list says ${line.qty}, plan totals ${expected}`,
    );
  }
});

test("usedInMeals and days match the plan", () => {
  const list = buildShoppingList(plan);
  const line = list.lines[0];

  const occurrences = plan.days.flatMap((d) =>
    d.meals.flatMap((m) => m.items.filter((i) => i.foodId === line.foodId).map(() => d.dayIndex)),
  );

  assert.equal(line.usedInMeals, occurrences.length);
  assert.deepEqual(line.days, [...new Set(occurrences)].sort((a, b) => a - b));
});

test("grouping loses nothing", () => {
  const list = buildShoppingList(plan);
  const grouped = list.byCategory.flatMap((g) => g.lines).length;
  assert.equal(grouped, list.lines.length);
  // No empty aisles.
  assert.ok(list.byCategory.every((g) => g.lines.length > 0));
});

test("the list is deterministic, like the plan it comes from", () => {
  const a = buildShoppingList(generatePlan(makeInput()));
  const b = buildShoppingList(generatePlan(makeInput()));
  assert.deepEqual(a, b);
});

test("grams climb to kg past 1000, pieces stay whole", () => {
  const list = buildShoppingList(plan);

  for (const line of list.lines) {
    if (line.unit === "piece") {
      assert.match(line.display, /^\d+ (piece|pieces)$/, line.name);
    } else if (line.qty >= 1000) {
      assert.match(line.display, /^[\d.]+ (kg|L)$/, `${line.name} (${line.qty}${line.unit})`);
    } else {
      assert.match(line.display, /^\d+ (g|ml)$/, `${line.name} (${line.qty}${line.unit})`);
    }
  }
});

test("the text export lists every item under a heading", () => {
  const list = buildShoppingList(plan);
  const text = shoppingListText(list);

  for (const line of list.lines) {
    assert.ok(text.includes(line.name), `missing ${line.name}`);
  }
  for (const group of list.byCategory) {
    assert.ok(text.includes(group.label.toUpperCase()), `missing heading ${group.label}`);
  }
});
