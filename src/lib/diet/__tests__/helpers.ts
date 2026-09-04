import type { AllergenTag, UserInput, Weekday } from "../types";

/** A middle-of-the-road input, overridable per test. */
export function makeInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    age: 30,
    gender: "male",
    heightCm: 175,
    weightKg: 80,
    activityLevel: "moderate",
    goal: "fat_loss",
    dietType: "non_veg",
    nonVegDays: [1, 4] as Weekday[],
    excludeTags: [] as AllergenTag[],
    excludeFoodIds: [],
    mealsPerDay: 4,
    ...overrides,
  };
}

/**
 * A deterministic sweep across the meaningful input space, used by the
 * constraint and tolerance suites. Index-based, never random, so a failure is
 * always reproducible.
 */
export function sweep(): UserInput[] {
  const out: UserInput[] = [];
  const genders = ["male", "female"] as const;
  const goals = ["fat_loss", "muscle_gain", "maintenance"] as const;
  const diets = ["vegan", "vegetarian", "non_veg"] as const;
  const activities = ["sedentary", "light", "moderate", "active", "athlete"] as const;
  const meals = [3, 4, 5, 6] as const;

  let i = 0;
  for (const gender of genders) {
    for (const goal of goals) {
      for (const dietType of diets) {
        for (const mealsPerDay of meals) {
          i++;
          out.push(
            makeInput({
              gender,
              goal,
              dietType,
              mealsPerDay,
              // Vary the body across the sweep so we cover small and large frames.
              age: 18 + ((i * 7) % 50),
              heightCm: 150 + ((i * 11) % 40),
              weightKg: 45 + ((i * 13) % 60),
              activityLevel: activities[i % activities.length],
              nonVegDays:
                dietType === "non_veg" ? ([(i % 7) as Weekday, ((i + 3) % 7) as Weekday]) : [],
            }),
          );
        }
      }
    }
  }
  return out;
}
