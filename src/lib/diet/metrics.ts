import {
  ACTIVITY_MULTIPLIER,
  ADHERENCE_FACTOR,
  CARB_MIN_G,
  FAT_MIN_G_PER_KG,
  FAT_PCT_OF_KCAL,
  GOAL_ADJUST,
  KCAL_FLOOR,
  KCAL_PER_KG_FAT,
  LIMITS,
  PROTEIN_G_PER_KG,
  PROTEIN_MAX_KCAL_SHARE,
  TARGET_BMI,
  VEGAN_PROTEIN_UPLIFT,
  WATER_ACTIVITY_BONUS,
  WATER_MAX_ML,
  WATER_ML_PER_KG,
} from "./constants";
import {
  InvalidInputError,
  type BmiCategoryAsian,
  type BmiCategoryWho,
  type Gender,
  type Macros,
  type Metrics,
  type UserInput,
  type Weekday,
} from "./types";

const round = (v: number, dp = 0) => {
  const f = 10 ** dp;
  const r = Math.round(v * f) / f;
  // Normalise negative zero. A maintenance goal yields -0 otherwise, which is
  // not equal to 0 under Object.is and would undermine determinism checks.
  return r === 0 ? 0 : r;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round10 = (v: number) => Math.round(v / 10) * 10;
const round50 = (v: number) => Math.round(v / 50) * 50;

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

export function bmiCategoryWho(value: number): BmiCategoryWho {
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  if (value < 35) return "obese_1";
  if (value < 40) return "obese_2";
  return "obese_3";
}

/**
 * WHO Asia-Pacific / ICMR cutoffs. These are the ones that actually apply to
 * Indian body composition — overweight starts at 23, not 25 — and the plan
 * reports both so the difference is visible rather than silently assumed.
 */
export function bmiCategoryAsian(value: number): BmiCategoryAsian {
  if (value < 18.5) return "underweight";
  if (value < 23) return "normal";
  if (value < 25) return "overweight";
  return "obese";
}

/** Mifflin-St Jeor — better real-world accuracy than Harris-Benedict. */
export function bmr(input: Pick<UserInput, "weightKg" | "heightCm" | "age" | "gender">): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(base + (input.gender === "male" ? 5 : -161));
}

export function tdee(bmrValue: number, activity: UserInput["activityLevel"]): number {
  return Math.round(bmrValue * ACTIVITY_MULTIPLIER[activity]);
}

/** Hamwi-style ideal weight, used to damp protein targets for obese users. */
export function idealWeightKg(heightCm: number): number {
  return round(TARGET_BMI * (heightCm / 100) ** 2, 1);
}

export function targetCalories(
  tdeeValue: number,
  goal: UserInput["goal"],
  gender: Gender,
): { targetKcal: number; appliedFloor: boolean } {
  const adjust = GOAL_ADJUST[goal];
  const magnitude = Math.abs(tdeeValue * adjust.pct);
  const delta =
    adjust.pct === 0 ? 0 : Math.sign(adjust.pct) * clamp(magnitude, adjust.minAbs, adjust.maxAbs);

  const raw = tdeeValue + delta;
  const floor = KCAL_FLOOR[gender];

  if (raw < floor) return { targetKcal: floor, appliedFloor: true };
  return { targetKcal: round10(raw), appliedFloor: false };
}

/**
 * Macro split, resolved in priority order: protein, then fat, then carbs as the
 * remainder. When the three cannot coexist the shortfall is taken from fat down
 * to its essential floor, and only then from protein — never from carbs below
 * CARB_MIN_G, because an Indian meal plan without carbs is not one anyone eats.
 */
export function macroSplit(kcal: number, input: UserInput, bmiValue: number): Macros {
  // Scaling protein off raw bodyweight for an obese user asks for ~220 g/day,
  // which is neither necessary nor achievable, so use an adjusted weight.
  const ideal = idealWeightKg(input.heightCm);
  const refWeight =
    bmiValue >= 30 ? ideal + 0.25 * (input.weightKg - ideal) : input.weightKg;

  let proteinG = Math.round(
    refWeight * PROTEIN_G_PER_KG[input.goal] * (input.dietType === "vegan" ? VEGAN_PROTEIN_UPLIFT : 1),
  );
  proteinG = Math.min(proteinG, Math.floor((kcal * PROTEIN_MAX_KCAL_SHARE) / 4));

  const fatFloor = Math.round(refWeight * FAT_MIN_G_PER_KG);
  let fatG = Math.max(Math.round((kcal * FAT_PCT_OF_KCAL[input.goal]) / 9), fatFloor);
  let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);

  if (carbsG < CARB_MIN_G) {
    const deficitKcal = (CARB_MIN_G - carbsG) * 4;
    const fatGiveable = Math.max(0, fatG - fatFloor);
    const fatGive = Math.min(fatGiveable, Math.ceil(deficitKcal / 9));
    fatG -= fatGive;
    carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  }

  if (carbsG < CARB_MIN_G) {
    const deficitKcal = (CARB_MIN_G - carbsG) * 4;
    // Give up protein last, and never below 1.2 g/kg.
    const proteinFloor = Math.round(refWeight * 1.2);
    const proteinGive = Math.min(
      Math.max(0, proteinG - proteinFloor),
      Math.ceil(deficitKcal / 4),
    );
    proteinG -= proteinGive;
    carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  }

  return { proteinG, carbsG: Math.max(0, carbsG), fatG };
}

export function waterMl(input: UserInput): number {
  const raw = input.weightKg * WATER_ML_PER_KG + WATER_ACTIVITY_BONUS[input.activityLevel];
  return Math.min(WATER_MAX_ML, round50(raw));
}

export function projection(
  tdeeValue: number,
  targetKcal: number,
  input: UserInput,
): Pick<Metrics, "projectedWeeklyKg" | "timeline"> {
  const weeklyKg = ((targetKcal - tdeeValue) * 7) / KCAL_PER_KG_FAT;
  const targetWeightKg = idealWeightKg(input.heightCm);
  const deltaKg = round(targetWeightKg - input.weightKg, 1);

  const effectiveWeekly = weeklyKg * ADHERENCE_FACTOR;
  const weeksRealistic =
    effectiveWeekly === 0 || deltaKg === 0
      ? 0
      : Math.ceil(Math.abs(deltaKg / effectiveWeekly));

  return {
    projectedWeeklyKg: round(weeklyKg, 2),
    timeline: { targetWeightKg, deltaKg, weeksRealistic },
  };
}

/**
 * The single place that throws. Everything downstream may assume valid input.
 * Clamps where a value is merely out of a sensible band; rejects where the
 * value cannot be interpreted at all.
 */
export function validateAndClamp(raw: UserInput): UserInput {
  const num = (v: unknown, field: string) => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    if (typeof n !== "number" || !Number.isFinite(n)) {
      throw new InvalidInputError(field, `${field} must be a number`);
    }
    return n;
  };

  const age = num(raw.age, "age");
  if (age < LIMITS.age.min) {
    throw new InvalidInputError(
      "age",
      `Plans are only generated for ages ${LIMITS.age.min} and above. Please consult a paediatric dietician.`,
    );
  }

  if (raw.gender !== "male" && raw.gender !== "female") {
    throw new InvalidInputError("gender", "Select a biological sex — it changes the BMR formula.");
  }

  const heightCm = num(raw.heightCm, "heightCm");
  const weightKg = num(raw.weightKg, "weightKg");
  if (heightCm < LIMITS.heightCm.min || heightCm > LIMITS.heightCm.max) {
    throw new InvalidInputError("heightCm", "Enter a height between 120 cm and 220 cm.");
  }
  if (weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max) {
    throw new InvalidInputError("weightKg", "Enter a weight between 30 kg and 250 kg.");
  }

  if (!ACTIVITY_MULTIPLIER[raw.activityLevel]) {
    throw new InvalidInputError("activityLevel", "Select an activity level.");
  }
  if (!GOAL_ADJUST[raw.goal]) {
    throw new InvalidInputError("goal", "Select a goal.");
  }
  if (!["vegan", "vegetarian", "non_veg"].includes(raw.dietType)) {
    throw new InvalidInputError("dietType", "Select a diet preference.");
  }
  if (![3, 4, 5, 6].includes(raw.mealsPerDay)) {
    throw new InvalidInputError("mealsPerDay", "Choose between 3 and 6 meals a day.");
  }

  // Normalisation matters beyond tidiness: these values feed the plan seed, so
  // {Tue,Fri} and {Fri,Tue} must produce an identical plan.
  const nonVegDays =
    raw.dietType === "non_veg"
      ? ([...new Set(raw.nonVegDays.filter((d) => d >= 0 && d <= 6))].sort(
          (a, b) => a - b,
        ) as Weekday[])
      : [];

  return {
    age: Math.round(clamp(age, LIMITS.age.min, LIMITS.age.max)),
    gender: raw.gender,
    heightCm: round(heightCm, 1),
    weightKg: round(weightKg, 1),
    activityLevel: raw.activityLevel,
    goal: raw.goal,
    dietType: raw.dietType,
    nonVegDays,
    excludeTags: [...new Set(raw.excludeTags)].sort(),
    excludeFoodIds: [...new Set(raw.excludeFoodIds)].sort(),
    mealsPerDay: raw.mealsPerDay,
  };
}

export function computeMetrics(input: UserInput): Metrics {
  const bmiValue = bmi(input.weightKg, input.heightCm);
  const bmrValue = bmr(input);
  const tdeeValue = tdee(bmrValue, input.activityLevel);
  const { targetKcal, appliedFloor } = targetCalories(tdeeValue, input.goal, input.gender);
  const macros = macroSplit(targetKcal, input, bmiValue);
  const { projectedWeeklyKg, timeline } = projection(tdeeValue, targetKcal, input);

  return {
    bmi: bmiValue,
    bmiCategoryWho: bmiCategoryWho(bmiValue),
    bmiCategoryAsian: bmiCategoryAsian(bmiValue),
    bmr: bmrValue,
    tdee: tdeeValue,
    targetKcal,
    appliedFloor,
    macros,
    waterMl: waterMl(input),
    projectedWeeklyKg,
    timeline,
  };
}
