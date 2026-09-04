/**
 * Types for the diet engine.
 *
 * Everything under src/lib/diet is a pure library: no React, no Next, no
 * network, no Math.random, no Date.now, no implicit-locale Intl. It must
 * produce byte-identical output on the server, in the browser, and in tests.
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type Goal = "fat_loss" | "muscle_gain" | "maintenance";
export type DietType = "vegan" | "vegetarian" | "non_veg";
export type MealsPerDay = 3 | 4 | 5 | 6;

/**
 * 0 = Monday .. 6 = Sunday.
 *
 * Deliberately NOT JavaScript's Date.getDay() convention (0 = Sunday). Indian
 * clients think of their week starting Monday, and day 1 of a plan should be
 * Monday. Convert at the UI boundary with `fromJsDay()` — never inline.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type FoodCategory =
  | "grain"
  | "legume"
  | "plant_protein"
  | "dairy"
  | "egg"
  | "meat"
  | "fish"
  | "vegetable"
  | "fruit"
  | "nut_seed"
  | "fat"
  | "beverage"
  | "snack"
  | "supplement";

/** The most restrictive diet a food is compatible with. */
export type DietTag = "vegan" | "vegetarian" | "non_veg";

export type AllergenTag = "dairy" | "gluten" | "nut" | "soy" | "egg" | "fish" | "shellfish";

/** The job a food does inside a meal slot. Drives selection. */
export type FoodRole = "protein" | "carb" | "veg" | "fruit" | "fat" | "drink" | "snack";

export type Unit = "g" | "ml" | "piece";

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  diet: DietTag;
  allergens: AllergenTag[];
  roles: FoodRole[];
  /** Reference serving that every macro below is stated for. */
  base: { qty: number; unit: Unit; measure: string };
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Portion granularity, as a multiplier of `base.qty`. */
  step: number;
  min: number;
  max: number;
  /** Preference weight — commonality and cost. Tie-breaker only, never random. */
  rank: number;
  /**
   * True for composed dishes whose stated macros already include cooking oil.
   * The selector must not add a separate fat item to a slot containing one, or
   * the plan double-counts ghee.
   */
  includesCookingFat?: boolean;
}

export interface UserInput {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  dietType: DietType;
  /** Only meaningful when dietType is "non_veg". Normalised to [] otherwise. */
  nonVegDays: Weekday[];
  /** Allergen tags to exclude wholesale. */
  excludeTags: AllergenTag[];
  /** Specific food ids the user dislikes. */
  excludeFoodIds: string[];
  mealsPerDay: MealsPerDay;
}

export type BmiCategoryWho =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese_1"
  | "obese_2"
  | "obese_3";

export type BmiCategoryAsian = "underweight" | "normal" | "overweight" | "obese";

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Metrics {
  bmi: number;
  bmiCategoryWho: BmiCategoryWho;
  bmiCategoryAsian: BmiCategoryAsian;
  bmr: number;
  tdee: number;
  targetKcal: number;
  /** True when the calorie floor overrode the goal deficit. Surface this. */
  appliedFloor: boolean;
  macros: Macros;
  waterMl: number;
  /** Negative means loss. Linear estimate — TDEE falls as weight does. */
  projectedWeeklyKg: number;
  timeline: {
    targetWeightKg: number;
    deltaKg: number;
    weeksRealistic: number;
  };
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanItem {
  foodId: string;
  name: string;
  /** Household measure, scaled: "2 roti", "1½ katori (225 g)". */
  measure: string;
  qty: number;
  unit: Unit;
  multiplier: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanMeal {
  slotId: string;
  label: string;
  timeHint: string;
  targetKcal: number;
  items: PlanItem[];
  totals: Totals;
}

export interface PlanDay {
  /** 1-based, for display. */
  dayIndex: number;
  weekday: Weekday;
  label: string;
  isNonVegDay: boolean;
  meals: PlanMeal[];
  totals: Totals;
  deviation: {
    kcalPct: number;
    proteinPct: number;
    withinTolerance: boolean;
  };
}

export interface DietPlan {
  /** Bump ENGINE_VERSION whenever foods or rules change — invalidates caches. */
  version: string;
  seed: number;
  input: UserInput;
  metrics: Metrics;
  days: PlanDay[];
  weekAverages: Totals;
  notes: string[];
  tips: string[];
  /** Constraints the engine could not fully satisfy. Never hide these. */
  warnings: string[];
}

export class InvalidInputError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "InvalidInputError";
    this.field = field;
  }
}
