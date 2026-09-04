import { ENGINE_VERSION } from "./constants";
import type { Food, UserInput } from "./types";

/**
 * Determinism, without randomness.
 *
 * Variety across the seven days comes from arithmetic on a single seed derived
 * from the user's own normalised input — never from Math.random. This matters
 * because plans are persisted and re-rendered after payment: regenerating from
 * the same intake must produce a byte-identical plan.
 */

/** FNV-1a, 32-bit. Fast, stable, and identical across JS engines. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // The shift-add chain is FNV's 32-bit prime multiply, kept in uint32.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Canonical string form of the input.
 *
 * Arrays are pre-sorted by validateAndClamp, so {Tue,Fri} and {Fri,Tue} hash
 * identically. ENGINE_VERSION is included so a rules change deliberately
 * reshuffles plans rather than leaving stale output that no longer matches the
 * current algorithm.
 */
export function normalizeInput(input: UserInput): string {
  return JSON.stringify([
    input.age,
    input.gender,
    Math.round(input.heightCm),
    Math.round(input.weightKg),
    input.activityLevel,
    input.goal,
    input.dietType,
    input.nonVegDays,
    input.excludeTags,
    input.excludeFoodIds,
    input.mealsPerDay,
    ENGINE_VERSION,
  ]);
}

export function seedFor(input: UserInput): number {
  return fnv1a32(normalizeInput(input));
}

// Distinct odd constants (golden-ratio / xxHash derived) so day, slot and role
// contributions don't alias into each other.
const P_DAY = 0x9e3779b1;
const P_SLOT = 0x85ebca6b;
const P_ROLE = 0xc2b2ae35;

/** Deterministic starting index into a candidate pool. -1 for an empty pool. */
export function offsetFor(
  seed: number,
  day: number,
  slot: number,
  role: number,
  poolSize: number,
): number {
  if (poolSize <= 0) return -1;
  const mixed =
    (seed ^ Math.imul(day + 1, P_DAY) ^ Math.imul(slot + 1, P_SLOT) ^ Math.imul(role + 1, P_ROLE)) >>>
    0;
  return mixed % poolSize;
}

/**
 * Linear probe forward from `start`, skipping rejected candidates.
 *
 * Returns null when every candidate is rejected — callers relax their
 * constraints in tiers rather than accepting a duplicate. Serving the same dal
 * twice in one day reads as a broken plan, so a skipped role is preferable.
 */
export function pickWithProbe(
  pool: readonly Food[],
  start: number,
  reject: (food: Food) => boolean,
): Food | null {
  if (pool.length === 0 || start < 0) return null;
  for (let k = 0; k < pool.length; k++) {
    const food = pool[(start + k) % pool.length];
    if (!reject(food)) return food;
  }
  return null;
}
