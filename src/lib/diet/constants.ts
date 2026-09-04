import type { ActivityLevel, Gender, Goal, Weekday } from "./types";

/** Bump on any change to foods, templates or rules. Persisted with each plan. */
export const ENGINE_VERSION = "1.0.0";

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Desk job, little movement",
  light: "Light activity, 1–3 workouts a week",
  moderate: "Moderate, 3–5 workouts a week",
  active: "Active, 6–7 workouts a week",
  athlete: "Athlete or physical job",
};

export const GOAL_LABEL: Record<Goal, string> = {
  fat_loss: "Fat loss",
  muscle_gain: "Muscle gain",
  maintenance: "Maintain and recomposition",
};

/**
 * Goal adjustment as a fraction of TDEE, then clamped to absolute kcal bounds
 * so a very large TDEE doesn't produce an unsafe 900 kcal deficit.
 */
export const GOAL_ADJUST: Record<Goal, { pct: number; minAbs: number; maxAbs: number }> = {
  fat_loss: { pct: -0.2, minAbs: 300, maxAbs: 750 },
  muscle_gain: { pct: 0.12, minAbs: 200, maxAbs: 450 },
  maintenance: { pct: 0, minAbs: 0, maxAbs: 0 },
};

/**
 * Hard calorie floors. Non-negotiable safety rail: an automated tool must never
 * hand someone a starvation target. When this binds, the UI says so.
 */
export const KCAL_FLOOR: Record<Gender, number> = { female: 1200, male: 1500 };

/** Grams of protein per kg of reference bodyweight. */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  fat_loss: 2.0,
  muscle_gain: 1.8,
  maintenance: 1.5,
};

/** Plant proteins score lower on DIAAS, so ask for a little more. */
export const VEGAN_PROTEIN_UPLIFT = 1.1;

/** Protein is capped at this share of energy — beyond it plans get unpalatable. */
export const PROTEIN_MAX_KCAL_SHARE = 0.4;

export const FAT_PCT_OF_KCAL: Record<Goal, number> = {
  fat_loss: 0.25,
  muscle_gain: 0.25,
  maintenance: 0.3,
};

/** Essential-fat floor, grams per kg. */
export const FAT_MIN_G_PER_KG = 0.6;

/** Below this, plans stop being practical to eat in an Indian kitchen. */
export const CARB_MIN_G = 100;

export const WATER_ML_PER_KG = 35;
export const WATER_ACTIVITY_BONUS: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 250,
  moderate: 500,
  active: 750,
  athlete: 1000,
};
export const WATER_MAX_ML = 4500;

export const KCAL_PER_KG_FAT = 7700;
/** Real-world adherence padding applied to projected timelines. */
export const ADHERENCE_FACTOR = 0.85;

/** BMI used as the mid-normal target on the Asian-Indian scale. */
export const TARGET_BMI = 22;

export const TOLERANCE = {
  /** Day kcal must land within the looser of ±5% or ±60 kcal. */
  kcalPct: 0.05,
  kcalAbsFloor: 60,
  proteinMinPct: 0.95,
  proteinMaxPct: 1.2,
  fatPct: 0.2,
  /** Bounded so the correction pass can never spin. */
  maxCorrectionPasses: 80,
  /**
   * Each repair adds or swaps one item. A vegan muscle-gain target on only three
   * meals a day needs several extra staples before the ceiling clears the goal,
   * so this is deliberately generous — every attempt is scored and the best
   * state is kept, so extra budget can only help.
   */
  maxStructuralRepairs: 8,
};

/** Input guards. Clamp where sane, reject where not. */
export const LIMITS = {
  age: { min: 15, max: 90 },
  heightCm: { min: 120, max: 220 },
  weightKg: { min: 30, max: 250 },
};

export const WEEKDAY_LABEL: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAY_SHORT: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** JS Date.getDay() (0 = Sunday) -> engine Weekday (0 = Monday). */
export function fromJsDay(jsDay: number): Weekday {
  return ((jsDay + 6) % 7) as Weekday;
}

/** Engine Weekday -> JS Date.getDay(). */
export function toJsDay(weekday: Weekday): number {
  return (weekday + 1) % 7;
}
