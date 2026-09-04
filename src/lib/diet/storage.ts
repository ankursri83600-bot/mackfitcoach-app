import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DietPlan, UserInput } from "./types";

/**
 * Plan persistence.
 *
 * Writes to Supabase when it is configured, and falls back to an in-process Map
 * when it is not, so the whole intake -> plan -> PDF flow works with zero
 * credentials. The fallback is explicitly NOT durable: it is lost on restart and
 * is not shared between server instances.
 */

export interface StoredPlan {
  input: UserInput;
  plan: DietPlan;
  /** Set for guest plans; the bearer proof until an account claims it. */
  claimToken: string | null;
  userId: string | null;
  requestId: string | null;
}

type Entry = StoredPlan & { createdAt: number };

/**
 * Pinned to globalThis, not a plain module-level Map.
 *
 * Next bundles Server Actions and Route Handlers separately, so a module-scoped
 * Map gives each its OWN instance even inside one process. That is not
 * theoretical: it made the plan page (which shares the action's bundle) find a
 * plan while /api/plan/[id]/pdf returned 404 for the very same id.
 */
const globalStore = globalThis as typeof globalThis & {
  __mfcPlanStore?: Map<string, Entry>;
};
globalStore.__mfcPlanStore ??= new Map<string, Entry>();
const memory = globalStore.__mfcPlanStore;

const MAX_ENTRIES = 500;
const TTL_MS = 1000 * 60 * 60 * 24;

function evictStale() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of memory) {
    if (entry.createdAt < cutoff) memory.delete(id);
  }
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (!oldest) break;
    memory.delete(oldest);
  }
}

export interface SavePlanArgs {
  planId: string;
  input: UserInput;
  plan: DietPlan;
  claimToken: string | null;
  userId: string | null;
  contact?: { fullName?: string; email?: string; phone?: string; medicalNotes?: string };
}

/**
 * Persists an intake row and its generated plan.
 *
 * Uses the service-role client because `diet_requests` has no insert policy —
 * the computed metrics must come from the engine, never from a client that could
 * claim a 4000 kcal target for a fat-loss goal.
 */
export async function savePlan(args: SavePlanArgs): Promise<void> {
  const { planId, input, plan, claimToken, userId, contact } = args;

  const admin = createAdminClient();
  if (!admin) {
    evictStale();
    memory.set(planId, {
      input,
      plan,
      claimToken,
      userId,
      requestId: null,
      createdAt: Date.now(),
    });
    return;
  }

  const { metrics } = plan;

  const { data: request, error: requestError } = await admin
    .from("diet_requests")
    .insert({
      user_id: userId,
      claim_token: userId ? null : claimToken,
      full_name: contact?.fullName ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      medical_notes: contact?.medicalNotes ?? null,
      age: input.age,
      gender: input.gender,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      activity: input.activityLevel,
      goal: input.goal,
      diet_type: input.dietType,
      nonveg_days: input.nonVegDays,
      exclude_tags: input.excludeTags,
      exclude_food_ids: input.excludeFoodIds,
      meals_per_day: input.mealsPerDay,
      bmi: metrics.bmi,
      bmi_category: metrics.bmiCategoryAsian,
      bmr_kcal: metrics.bmr,
      tdee_kcal: metrics.tdee,
      target_kcal: metrics.targetKcal,
      protein_g: metrics.macros.proteinG,
      carbs_g: metrics.macros.carbsG,
      fat_g: metrics.macros.fatG,
      status: "plan_generated",
    })
    .select("id")
    .single();

  if (requestError || !request) {
    console.error("[diet] failed to persist intake", requestError);
    throw new Error("Could not save your details. Please try again.");
  }

  const { error: planError } = await admin.from("diet_plans").insert({
    id: planId,
    request_id: request.id,
    user_id: userId,
    claim_token: userId ? null : claimToken,
    engine_version: plan.version,
    seed: plan.seed,
    plan_json: plan,
  });

  if (planError) {
    console.error("[diet] failed to persist plan", planError);
    throw new Error("Could not save your plan. Please try again.");
  }
}

/** Fetches a stored plan by id. Returns null when it does not exist. */
export async function getPlan(planId: string): Promise<StoredPlan | null> {
  const admin = createAdminClient();

  if (!admin) {
    const entry = memory.get(planId);
    return entry
      ? {
          input: entry.input,
          plan: entry.plan,
          claimToken: entry.claimToken,
          userId: entry.userId,
          requestId: entry.requestId,
        }
      : null;
  }

  const { data, error } = await admin
    .from("diet_plans")
    .select("plan_json, claim_token, user_id, request_id")
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) return null;

  const plan = data.plan_json as DietPlan;
  return {
    input: plan.input,
    plan,
    claimToken: data.claim_token as string | null,
    userId: data.user_id as string | null,
    requestId: data.request_id as string | null,
  };
}

/** Plans belonging to a user, newest first — for the dashboard. */
export async function listPlansForUser(userId: string) {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("diet_plans")
    .select("id, created_at, request_id, plan_json")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => {
    const plan = row.plan_json as DietPlan;
    return {
      id: row.id as string,
      requestId: row.request_id as string,
      createdAt: row.created_at as string,
      targetKcal: plan.metrics.targetKcal,
      bmi: plan.metrics.bmi,
      goal: plan.input.goal,
      dietType: plan.input.dietType,
    };
  });
}

/** Attaches any guest plan held by this token to a newly created account. */
export async function claimGuestPlan(userId: string, claimToken: string) {
  const admin = createAdminClient();
  if (!admin) {
    for (const entry of memory.values()) {
      if (entry.claimToken === claimToken) {
        entry.userId = userId;
        entry.claimToken = null;
      }
    }
    return;
  }

  const { error } = await admin.rpc("claim_diet_request", {
    p_user_id: userId,
    p_claim_token: claimToken,
  });
  if (error) console.error("[diet] claim failed", error);
}
