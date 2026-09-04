import { FOOD_BY_ID } from "./foods";
import type { DietPlan, FoodCategory, Unit } from "./types";

/**
 * Turn a 7-day plan into a shopping list.
 *
 * Pure, like the rest of the engine: same plan in, byte-identical list out.
 * There is no rounding to "nice" numbers and no serving-count guesswork — the
 * quantities are literally the sum of what the plan asks you to eat, because a
 * list that quietly rounds 380 g of paneer up to 500 g is how a calorie target
 * gets missed by a fortnight's worth of fat.
 *
 * Aggregation is by FOOD ID, not by name. Two rows can share a display name
 * across categories, and merging those would silently combine unrelated items.
 */

export interface ShoppingLine {
  foodId: string;
  name: string;
  category: FoodCategory;
  /** Total across the whole plan, in the food's own base unit. */
  qty: number;
  unit: Unit;
  /** Human-facing amount: "1.2 kg", "14 pieces", "750 ml". */
  display: string;
  /** How many separate meals across the week use it. */
  usedInMeals: number;
  /** Which days (1-based) it appears on, ascending. */
  days: number[];
}

export interface ShoppingList {
  lines: ShoppingLine[];
  /** Grouped in the order you actually walk a shop. */
  byCategory: { category: FoodCategory; label: string; lines: ShoppingLine[] }[];
  totalItems: number;
}

/**
 * Aisle order. Produce first because it is what spoils, staples last because
 * they are heavy — the same reason a person shops in this order without being
 * told to.
 */
const CATEGORY_ORDER: FoodCategory[] = [
  "vegetable",
  "fruit",
  "meat",
  "fish",
  "egg",
  "dairy",
  "plant_protein",
  "grain",
  "legume",
  "nut_seed",
  "fat",
  "beverage",
  "snack",
  "supplement",
];

const CATEGORY_LABEL: Record<FoodCategory, string> = {
  vegetable: "Vegetables",
  fruit: "Fruit",
  meat: "Meat and poultry",
  fish: "Fish",
  egg: "Eggs",
  dairy: "Dairy",
  plant_protein: "Paneer, tofu and soya",
  grain: "Grains and flour",
  legume: "Dals and legumes",
  nut_seed: "Nuts and seeds",
  fat: "Oils and fats",
  beverage: "Drinks",
  snack: "Snacks",
  supplement: "Supplements",
};

/** Grams and millilitres climb to kg/L past 1000; pieces stay countable. */
function formatQty(qty: number, unit: Unit): string {
  if (unit === "piece") {
    const n = Math.ceil(qty);
    return `${n} ${n === 1 ? "piece" : "pieces"}`;
  }
  if (qty >= 1000) {
    const big = qty / 1000;
    // One decimal unless it is exact, so 1.5 kg reads as 1.5 kg and 2 kg as 2 kg.
    const text = Number.isInteger(big) ? String(big) : big.toFixed(1);
    return `${text} ${unit === "g" ? "kg" : "L"}`;
  }
  return `${Math.round(qty)} ${unit}`;
}

export function buildShoppingList(plan: DietPlan): ShoppingList {
  const acc = new Map<
    string,
    { qty: number; meals: number; days: Set<number>; unit: Unit; name: string; category: FoodCategory }
  >();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const food = FOOD_BY_ID.get(item.foodId);
        // `qty` on the item is already the scaled amount in the food's unit.
        const existing = acc.get(item.foodId);
        if (existing) {
          existing.qty += item.qty;
          existing.meals += 1;
          existing.days.add(day.dayIndex);
        } else {
          acc.set(item.foodId, {
            qty: item.qty,
            meals: 1,
            days: new Set([day.dayIndex]),
            unit: item.unit,
            name: item.name,
            // Every plan item is built from FOODS, so a miss here means the
            // food table changed under a persisted plan. File it under snacks
            // rather than dropping the line — a missing ingredient is worse
            // than a mis-shelved one.
            category: food?.category ?? "snack",
          });
        }
      }
    }
  }

  const lines: ShoppingLine[] = [...acc.entries()]
    .map(([foodId, v]) => ({
      foodId,
      name: v.name,
      category: v.category,
      qty: Math.round(v.qty * 10) / 10,
      unit: v.unit,
      display: formatQty(v.qty, v.unit),
      usedInMeals: v.meals,
      days: [...v.days].sort((a, b) => a - b),
    }))
    // Within an aisle, the things you need most of first.
    .sort((a, b) => b.usedInMeals - a.usedInMeals || a.name.localeCompare(b.name));

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    lines: lines.filter((l) => l.category === category),
  })).filter((g) => g.lines.length > 0);

  return { lines, byCategory, totalItems: lines.length };
}

/** Plain-text list, for the WhatsApp / notes-app copy button. */
export function shoppingListText(list: ShoppingList, title = "Shopping list"): string {
  const out: string[] = [title, ""];
  for (const group of list.byCategory) {
    out.push(group.label.toUpperCase());
    for (const line of group.lines) {
      out.push(`- ${line.name} — ${line.display}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}
