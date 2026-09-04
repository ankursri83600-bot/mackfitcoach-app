import { FOODS } from "./foods";
import type { Food, FoodRole, UserInput } from "./types";

export type Pool = ReadonlyMap<FoodRole, readonly Food[]>;

/**
 * Builds the candidate pool for one diet allowance.
 *
 * Called at most twice per plan — once for veg days, once for meat days — since
 * filtering is invariant within a day type. Doing it per slot would repeat the
 * same work 42 times.
 *
 * The crucial asymmetry: `dietType === "non_veg"` does NOT mean every day is a
 * meat day. `meatAllowed` is decided per day from the user's chosen nonVegDays,
 * and on every other day they eat from the vegetarian pool.
 */
export function buildPool(input: UserInput, meatAllowed: boolean): Pool {
  const excludedTags = new Set(input.excludeTags);
  const excludedIds = new Set(input.excludeFoodIds);

  const allowed = (food: Food): boolean => {
    if (excludedIds.has(food.id)) return false;
    if (food.allergens.some((tag) => excludedTags.has(tag))) return false;

    // Vegan excludes dairy and egg as well as meat; vegetarian excludes meat.
    if (input.dietType === "vegan" && food.diet !== "vegan") return false;
    if (input.dietType === "vegetarian" && food.diet === "non_veg") return false;

    if (food.diet === "non_veg" && !meatAllowed) return false;
    return true;
  };

  const byRole = new Map<FoodRole, Food[]>();
  for (const food of FOODS) {
    if (!allowed(food)) continue;
    for (const role of food.roles) {
      const list = byRole.get(role);
      if (list) list.push(food);
      else byRole.set(role, [food]);
    }
  }

  // Total order, so the rotation is reproducible: rank first, then id as the
  // tie-break. Never rely on insertion order.
  for (const list of byRole.values()) {
    list.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  return byRole;
}

/** Meat/fish subset of a role's pool, used to bias dinner and lunch on meat days. */
export function meatSubset(pool: Pool, role: FoodRole): readonly Food[] {
  return (pool.get(role) ?? []).filter((f) => f.diet === "non_veg");
}

/** Highest-protein-density candidate, used by the structural repair pass. */
export function proteinDense(pool: Pool, exclude: ReadonlySet<string>): Food | null {
  const candidates = (pool.get("protein") ?? []).filter((f) => !exclude.has(f.id));
  if (candidates.length === 0) return null;

  return candidates.reduce((best, f) => {
    const density = f.protein / Math.max(f.kcal, 1);
    const bestDensity = best.protein / Math.max(best.kcal, 1);
    // Strict > with an id tie-break keeps this deterministic.
    if (density > bestDensity) return f;
    if (density === bestDensity && f.id < best.id) return f;
    return best;
  });
}

/**
 * Highest-headroom candidate across the given roles, for the calorie fill pass.
 *
 * Headroom is the calories a food can contribute at its maximum portion, so a
 * plan that has run out of room adds something that genuinely closes the gap
 * instead of another cup of green tea.
 */
export function highestHeadroom(
  pool: Pool,
  roles: readonly FoodRole[],
  exclude: ReadonlySet<string>,
): Food | null {
  const seen = new Set<string>();
  const candidates: Food[] = [];

  for (const role of roles) {
    for (const food of pool.get(role) ?? []) {
      if (exclude.has(food.id) || seen.has(food.id)) continue;
      seen.add(food.id);
      candidates.push(food);
    }
  }
  if (candidates.length === 0) return null;

  return candidates.reduce((best, f) => {
    const headroom = f.kcal * f.max;
    const bestHeadroom = best.kcal * best.max;
    if (headroom > bestHeadroom) return f;
    if (headroom === bestHeadroom && f.id < best.id) return f;
    return best;
  });
}
