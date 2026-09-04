import type { FoodRole, MealsPerDay } from "./types";

export interface Slot {
  id: string;
  label: string;
  timeHint: string;
  /** Share of the day's calories. Shares in a template must sum to exactly 1. */
  kcalShare: number;
  /** One item is chosen per role, in order. */
  roles: FoodRole[];
  /** Share of the day's protein this slot should carry. Sums to ~1. */
  proteinBias: number;
  /**
   * Whether meat/fish may appear here. Breakfast is false by default —
   * an Indian household rarely serves chicken at 8am, and a plan that ignores
   * that gets abandoned in week one.
   */
  allowMeat?: boolean;
}

/**
 * Meal-slot templates. The `kcalShare` values are asserted to sum to 1 in the
 * test suite, so a copy-paste error here fails the build rather than silently
 * producing an under-fed plan.
 */
export const TEMPLATES: Record<MealsPerDay, Slot[]> = {
  3: [
    {
      id: "breakfast",
      label: "Breakfast",
      timeHint: "8:00 AM",
      kcalShare: 0.3,
      roles: ["carb", "protein", "drink"],
      proteinBias: 0.28,
    },
    {
      id: "lunch",
      label: "Lunch",
      timeHint: "1:30 PM",
      kcalShare: 0.4,
      roles: ["carb", "protein", "veg", "fat"],
      proteinBias: 0.38,
      allowMeat: true,
    },
    {
      id: "dinner",
      label: "Dinner",
      timeHint: "8:00 PM",
      kcalShare: 0.3,
      roles: ["protein", "veg", "carb", "fat"],
      proteinBias: 0.34,
      allowMeat: true,
    },
  ],

  4: [
    {
      id: "breakfast",
      label: "Breakfast",
      timeHint: "8:00 AM",
      kcalShare: 0.26,
      roles: ["carb", "protein", "drink"],
      proteinBias: 0.24,
    },
    {
      id: "lunch",
      label: "Lunch",
      timeHint: "1:30 PM",
      kcalShare: 0.33,
      roles: ["carb", "protein", "veg", "fat"],
      proteinBias: 0.32,
      allowMeat: true,
    },
    {
      id: "snack",
      label: "Evening snack",
      timeHint: "5:00 PM",
      kcalShare: 0.13,
      roles: ["snack", "fruit"],
      proteinBias: 0.1,
    },
    {
      id: "dinner",
      label: "Dinner",
      timeHint: "8:30 PM",
      kcalShare: 0.28,
      roles: ["protein", "veg", "carb", "fat"],
      proteinBias: 0.34,
      allowMeat: true,
    },
  ],

  5: [
    {
      id: "breakfast",
      label: "Breakfast",
      timeHint: "8:00 AM",
      kcalShare: 0.23,
      roles: ["carb", "protein", "drink"],
      proteinBias: 0.22,
    },
    {
      id: "mid_morning",
      label: "Mid-morning",
      timeHint: "11:00 AM",
      kcalShare: 0.1,
      roles: ["fruit", "fat"],
      proteinBias: 0.06,
    },
    {
      id: "lunch",
      label: "Lunch",
      timeHint: "1:30 PM",
      kcalShare: 0.3,
      roles: ["carb", "protein", "veg", "fat"],
      proteinBias: 0.32,
      allowMeat: true,
    },
    {
      id: "snack",
      label: "Evening snack",
      timeHint: "5:30 PM",
      kcalShare: 0.12,
      roles: ["snack", "drink"],
      proteinBias: 0.1,
    },
    {
      id: "dinner",
      label: "Dinner",
      timeHint: "8:30 PM",
      kcalShare: 0.25,
      roles: ["protein", "veg", "carb", "fat"],
      proteinBias: 0.3,
      allowMeat: true,
    },
  ],

  6: [
    {
      id: "breakfast",
      label: "Breakfast",
      timeHint: "7:30 AM",
      kcalShare: 0.2,
      roles: ["carb", "protein", "drink"],
      proteinBias: 0.2,
    },
    {
      id: "mid_morning",
      label: "Mid-morning",
      timeHint: "10:30 AM",
      kcalShare: 0.09,
      roles: ["fruit", "fat"],
      proteinBias: 0.05,
    },
    {
      id: "lunch",
      label: "Lunch",
      timeHint: "1:00 PM",
      kcalShare: 0.26,
      roles: ["carb", "protein", "veg", "fat"],
      proteinBias: 0.28,
      allowMeat: true,
    },
    {
      id: "pre_workout",
      label: "Pre-workout",
      timeHint: "5:00 PM",
      kcalShare: 0.08,
      roles: ["fruit", "carb"],
      proteinBias: 0.04,
    },
    {
      id: "post_workout",
      label: "Post-workout",
      timeHint: "7:00 PM",
      kcalShare: 0.12,
      roles: ["protein", "carb"],
      proteinBias: 0.19,
    },
    {
      id: "dinner",
      label: "Dinner",
      timeHint: "9:00 PM",
      kcalShare: 0.25,
      roles: ["protein", "veg", "carb", "fat"],
      proteinBias: 0.24,
      allowMeat: true,
    },
  ],
};
