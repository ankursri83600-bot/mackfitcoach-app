"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { findSwaps, type StoredSwap, type SwapCandidate } from "@/lib/diet/swap";
import type { DietPlan } from "@/lib/diet/types";
import { getPlan } from "@/lib/diet/storage";
import { resolveAccess } from "@/lib/entitlements";
import { isRazorpayConfigured } from "@/lib/razorpay";

export type SwapResult = { ok: boolean; error?: string };

/**
 * Meal-swap actions.
 *
 * Every one of these re-derives access from the plan itself rather than
 * trusting the caller. A swap is a write against a paid artefact, so the same
 * `resolveAccess` that gates reading the plan gates changing it — otherwise
 * someone holding a plan id could rewrite a stranger's week.
 *
 * The request-scoped client is used deliberately: `plan_meal_swaps` is
 * owner-only by RLS, so the policy is the enforcement rather than a second
 * opinion, and a bug here cannot reach another user's rows.
 */

async function guard(planId: string) {
  const entry = await getPlan(planId);
  if (!entry) return { error: "Plan not found." as const };

  // No search params: the demo `?unlocked=1` must not authorise a WRITE.
  const access = await resolveAccess(entry, {}, isRazorpayConfigured());
  if (!access.canView) return { error: "Plan not found." as const };
  if (access.level !== "full") {
    return { error: "Swapping meals is part of the full plan." as const };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Database is not configured." as const };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to change your plan." as const };

  return { entry, supabase, userId: user.id };
}

/**
 * Resolve an item's ORIGINAL food id from its position in the stored plan.
 *
 * The client identifies an item by index, not by food id, and this is why:
 * once an item has been swapped, the id rendered on screen is the substitute,
 * while the swap row is keyed on the food that was there originally. Sending
 * the visible id back would fail to match the stored row, and swapping a
 * second time would insert a NEW row instead of replacing the first — leaving
 * two overrides for one item, applied in whatever order the database returned.
 *
 * Position is stable because `applySwaps` replaces items in place.
 */
function originalFoodId(plan: DietPlan, dayIndex: number, slotId: string, itemIndex: number) {
  const day = plan.days.find((d) => d.dayIndex === dayIndex);
  const meal = day?.meals.find((m) => m.slotId === slotId);
  return meal?.items[itemIndex]?.foodId ?? null;
}

/** Substitutes for one item. Computed server-side so the food table stays off the wire. */
export async function getSwapOptions(
  planId: string,
  dayIndex: number,
  slotId: string,
  itemIndex: number,
): Promise<{ options: SwapCandidate[]; error?: string }> {
  const g = await guard(planId);
  if ("error" in g) return { options: [], error: g.error };

  const fromFoodId = originalFoodId(g.entry.plan, dayIndex, slotId, itemIndex);
  if (!fromFoodId) return { options: [], error: "That item is no longer in the plan." };

  return { options: findSwaps(g.entry.plan, dayIndex, slotId, fromFoodId) };
}

export async function saveSwap(
  planId: string,
  dayIndex: number,
  slotId: string,
  itemIndex: number,
  toFoodId: string,
): Promise<SwapResult> {
  const g = await guard(planId);
  if ("error" in g) return { ok: false, error: g.error };

  const fromFoodId = originalFoodId(g.entry.plan, dayIndex, slotId, itemIndex);
  if (!fromFoodId) return { ok: false, error: "That item is no longer in the plan." };

  // Re-validate the CHOICE, not just the caller. The option list came from the
  // server, but the id posted back did not have to — an arbitrary food id
  // would otherwise sail past every allergen and diet filter.
  const allowed = findSwaps(g.entry.plan, dayIndex, slotId, fromFoodId, 500);
  if (!allowed.some((c) => c.foodId === toFoodId)) {
    return { ok: false, error: "That substitution is not valid for this meal." };
  }

  const { error } = await g.supabase.from("plan_meal_swaps").upsert(
    {
      plan_id: planId,
      user_id: g.userId,
      day_index: dayIndex,
      slot_id: slotId,
      from_food_id: fromFoodId,
      to_food_id: toFoodId,
    },
    { onConflict: "plan_id,day_index,slot_id,from_food_id" },
  );

  if (error) {
    if (error.code === "42P01") {
      return { ok: false, error: "Meal swapping is not set up yet — apply migration 0006." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/diet/${planId}`);
  return { ok: true };
}

export async function removeSwap(
  planId: string,
  dayIndex: number,
  slotId: string,
  itemIndex: number,
): Promise<SwapResult> {
  const g = await guard(planId);
  if ("error" in g) return { ok: false, error: g.error };

  const fromFoodId = originalFoodId(g.entry.plan, dayIndex, slotId, itemIndex);
  if (!fromFoodId) return { ok: true };

  const { error } = await g.supabase
    .from("plan_meal_swaps")
    .delete()
    .eq("plan_id", planId)
    .eq("day_index", dayIndex)
    .eq("slot_id", slotId)
    .eq("from_food_id", fromFoodId);

  if (error && error.code !== "42P01") return { ok: false, error: error.message };

  revalidatePath(`/diet/${planId}`);
  return { ok: true };
}

/** Swaps stored for a plan. Empty before migration 0006 — never throws. */
export async function listSwaps(planId: string): Promise<StoredSwap[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("plan_meal_swaps")
    .select("day_index, slot_id, from_food_id, to_food_id")
    .eq("plan_id", planId);

  if (error) {
    if (error.code !== "42P01") console.error("[swap] listSwaps failed", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    dayIndex: r.day_index as number,
    slotId: r.slot_id as string,
    fromFoodId: r.from_food_id as string,
    toFoodId: r.to_food_id as string,
  }));
}
