"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LogResult = { ok: boolean; error?: string };

/**
 * Weight logging.
 *
 * Uses the REQUEST-SCOPED client, not the admin one. `weight_logs` is
 * owner-only by RLS and these actions have no reason to bypass it — running
 * them as the caller means the policy is the enforcement, so a bug in this
 * file cannot write to another user's history.
 */

const LogSchema = z.object({
  weightKg: z.coerce
    .number()
    .min(20, "That weight looks wrong")
    .max(400, "That weight looks wrong"),
  loggedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
    .refine((d) => {
      // A weigh-in cannot be in the future. Allowing it would poison the trend
      // line and the projected-rate maths downstream.
      const today = new Date().toISOString().slice(0, 10);
      return d <= today;
    }, "You cannot log a future date"),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export async function logWeight(_prev: LogResult, formData: FormData): Promise<LogResult> {
  await requireUser();

  const parsed = LogSchema.safeParse({
    weightKg: String(formData.get("weightKg") ?? ""),
    loggedOn: String(formData.get("loggedOn") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Database is not configured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const v = parsed.data;

  // Upsert on (user_id, logged_on): re-logging the same day CORRECTS it. A
  // delete-then-insert would race with itself on a double submit.
  const { error } = await supabase.from("weight_logs").upsert(
    {
      user_id: user.id,
      logged_on: v.loggedOn,
      weight_kg: v.weightKg,
      note: v.note || null,
    },
    { onConflict: "user_id,logged_on" },
  );

  if (error) {
    // 42P01 = table absent, i.e. migration 0006 has not been applied.
    if (error.code === "42P01") {
      return { ok: false, error: "Progress tracking is not set up yet — apply migration 0006." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteWeightLog(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  if (!supabase) return;

  // No user_id filter needed — RLS restricts the delete to the caller's own
  // rows, and adding one here would imply the policy were optional.
  const { error } = await supabase.from("weight_logs").delete().eq("id", id);
  if (error) console.error("[progress] deleteWeightLog failed", error);

  revalidatePath("/dashboard");
}

export interface WeightPoint {
  id: string;
  logged_on: string;
  weight_kg: number;
  note: string | null;
}

/** Oldest-first, so the chart can render straight from the array. */
export async function listWeightLogs(limit = 180): Promise<WeightPoint[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("weight_logs")
    .select("id, logged_on, weight_kg, note")
    .order("logged_on", { ascending: false })
    .limit(limit);

  // A missing table is the pre-migration state, not an outage — return empty
  // and let the UI show its "not set up" hint.
  if (error) {
    if (error.code !== "42P01") console.error("[progress] listWeightLogs failed", error);
    return [];
  }

  return (data ?? [])
    .map((r) => ({
      id: r.id as string,
      logged_on: r.logged_on as string,
      weight_kg: Number(r.weight_kg),
      note: (r.note as string) ?? null,
    }))
    .reverse();
}
