"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { generatePlan } from "@/lib/diet/generate";
import { savePlan } from "@/lib/diet/storage";
import { InvalidInputError, type UserInput } from "@/lib/diet/types";
import { CLAIM_COOKIE } from "@/lib/entitlements";
import { getCurrentUser } from "@/lib/supabase/server";

export interface IntakeFormState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  return raw === null || raw === "" ? NaN : Number(raw);
}

function list(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String);
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : undefined;
}

/**
 * Generates and persists a plan, then redirects to it.
 *
 * Generation is pure and sub-millisecond, so it runs inline with no queue. A
 * signed-in user owns the plan directly; a guest gets an httpOnly claim token
 * cookie which is the bearer proof for that plan until an account claims it.
 */
export async function submitIntake(
  _prev: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const input: UserInput = {
    age: num(formData, "age"),
    gender: formData.get("gender") === "female" ? "female" : "male",
    heightCm: num(formData, "heightCm"),
    weightKg: num(formData, "weightKg"),
    activityLevel: (formData.get("activityLevel") as UserInput["activityLevel"]) || "moderate",
    goal: (formData.get("goal") as UserInput["goal"]) || "fat_loss",
    dietType: (formData.get("dietType") as UserInput["dietType"]) || "vegetarian",
    nonVegDays: list(formData, "nonVegDays").map(Number) as UserInput["nonVegDays"],
    excludeTags: list(formData, "excludeTags") as UserInput["excludeTags"],
    excludeFoodIds: list(formData, "excludeFoodIds"),
    mealsPerDay: (Number(formData.get("mealsPerDay")) || 4) as UserInput["mealsPerDay"],
  };

  const planId = randomUUID();
  const user = await getCurrentUser();
  const claimToken = user ? null : randomUUID();

  try {
    const plan = generatePlan(input);

    await savePlan({
      planId,
      input: plan.input,
      plan,
      claimToken,
      userId: user?.id ?? null,
      contact: {
        fullName: str(formData, "fullName"),
        email: str(formData, "email") ?? user?.email,
        phone: str(formData, "phone"),
        medicalNotes: str(formData, "medicalNotes"),
      },
    });

    if (claimToken) {
      const cookieStore = await cookies();
      cookieStore.set(CLAIM_COOKIE, claimToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  } catch (err) {
    if (err instanceof InvalidInputError) {
      return { error: err.message, fieldErrors: { [err.field]: err.message } };
    }
    console.error("[diet] plan generation failed", err);
    return {
      error:
        err instanceof Error && err.message.startsWith("Could not save")
          ? err.message
          : "Something went wrong building your plan. Please check your details and try again.",
      fieldErrors: {},
    };
  }

  redirect(`/diet/${planId}`);
}
