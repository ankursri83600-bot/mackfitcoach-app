"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Coach CRUD.
 *
 * Admin-only, not merely staff: a coach row decides who appears on the public
 * site and who can take bookings, and `coach_contacts` holds personal mobile
 * numbers. `requireAdmin()` throws, so every action below is gated by its
 * first line — there is no path that reaches the database without it.
 *
 * Each action returns `ActionResult` rather than throwing on validation
 * failure, because the forms render the message inline. Genuine faults (no
 * admin client, RLS refusal) still surface as an error string rather than a
 * blank screen.
 */
export type ActionResult = { ok: boolean; error?: string };

/** Revalidate everywhere a coach can appear. Cheap, and prevents stale reads. */
function revalidateCoaches(slug?: string) {
  revalidatePath("/admin/coaches");
  revalidatePath("/coaches");
  revalidatePath("/book");
  revalidatePath("/");
  if (slug) revalidatePath(`/coaches/${slug}`);
}

const SLUG = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens");

/** E.164, matching the CHECK constraint on coach_contacts.phone_e164. */
const PHONE = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, "Phone must be E.164, e.g. +919876543210");

const CoachSchema = z.object({
  slug: SLUG,
  name: z.string().trim().min(2, "Name is required").max(80),
  kind: z.enum(["trainer", "dietician"]),
  headline: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  // Comma-separated in the form; the column is text[].
  specialties: z.string().trim().max(400).optional().or(z.literal("")),
  slotMinutes: z.coerce.number().int().refine((n) => [15, 30, 45, 60].includes(n), {
    message: "Session length must be 15, 30, 45 or 60 minutes",
  }),
  leadTimeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 14),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.coerce.boolean(),
  phone: z.union([PHONE, z.literal("")]).optional(),
});

function parseSpecialties(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function fields(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? ""),
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? "trainer"),
    headline: String(formData.get("headline") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    specialties: String(formData.get("specialties") ?? ""),
    slotMinutes: String(formData.get("slotMinutes") ?? "30"),
    leadTimeMinutes: String(formData.get("leadTimeMinutes") ?? "120"),
    maxDaysAhead: String(formData.get("maxDaysAhead") ?? "30"),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    phone: String(formData.get("phone") ?? ""),
  };
}

export async function saveCoach(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = CoachSchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is not configured." };

  const id = String(formData.get("id") ?? "").trim();
  const row = {
    slug: v.slug,
    name: v.name,
    kind: v.kind,
    headline: v.headline || null,
    bio: v.bio || null,
    specialties: parseSpecialties(v.specialties),
    slot_minutes: v.slotMinutes,
    lead_time_minutes: v.leadTimeMinutes,
    max_days_ahead: v.maxDaysAhead,
    sort_order: v.sortOrder,
    is_active: v.isActive,
  };

  let coachId = id;

  if (id) {
    const { error } = await admin.from("coaches").update(row).eq("id", id);
    if (error) return { ok: false, error: friendly(error.message) };
  } else {
    const { data, error } = await admin.from("coaches").insert(row).select("id").single();
    if (error) return { ok: false, error: friendly(error.message) };
    coachId = data.id as string;
  }

  // The phone lives in its own table. An empty field DELETES the contact row
  // rather than storing "", which would fail the E.164 check constraint.
  if (v.phone) {
    const { error } = await admin
      .from("coach_contacts")
      .upsert({ coach_id: coachId, phone_e164: v.phone }, { onConflict: "coach_id" });
    if (error) return { ok: false, error: friendly(error.message) };
  } else if (id) {
    await admin.from("coach_contacts").delete().eq("coach_id", coachId);
  }

  revalidateCoaches(v.slug);
  return { ok: true };
}

export async function deleteCoach(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing coach id." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is not configured." };

  /**
   * Refuse to delete a coach who has bookings.
   *
   * `bookings.coach_id` is ON DELETE RESTRICT for a reason — a deleted coach
   * would orphan a booking a client is still expecting to happen. Deactivating
   * hides them from the public site and stops new bookings while leaving the
   * history intact, which is almost always what "delete" actually means here.
   */
  const { count, error: countError } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", id);

  if (countError) return { ok: false, error: friendly(countError.message) };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This coach has ${count} booking${count === 1 ? "" : "s"}. Deactivate them instead — deleting would orphan bookings clients are still expecting.`,
    };
  }

  const { error } = await admin.from("coaches").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };

  revalidateCoaches();
  return { ok: true };
}

export async function setCoachActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.from("coaches").update({ is_active: active }).eq("id", id);
  if (error) console.error("[admin] setCoachActive failed", error);

  revalidateCoaches();
}

/* ------------------------------------------------------ availability ---- */

const WindowSchema = z
  .object({
    coachId: z.string().uuid("Missing coach"),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export async function addAvailability(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = WindowSchema.safeParse({
    coachId: String(formData.get("coachId") ?? ""),
    weekday: String(formData.get("weekday") ?? "0"),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid window" };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is not configured." };

  const { error } = await admin.from("coach_availability").insert({
    coach_id: v.coachId,
    weekday: v.weekday,
    start_time: v.startTime,
    end_time: v.endTime,
  });

  // 23505 is the (coach_id, weekday, start_time) unique index.
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That window already exists." : friendly(error.message),
    };
  }

  revalidateCoaches();
  return { ok: true };
}

export async function deleteAvailability(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("windowId") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.from("coach_availability").delete().eq("id", id);
  if (error) console.error("[admin] deleteAvailability failed", error);

  revalidateCoaches();
}

/**
 * Postgres messages are precise but unfriendly. Translate only the ones an
 * admin can actually act on, and pass everything else through — swallowing an
 * unexpected error into "Something went wrong" is how bugs get hidden.
 */
function friendly(message: string): string {
  if (message.includes("coaches_slug_key")) return "That slug is already taken.";
  if (message.includes("phone_e164_check")) return "Phone must be E.164, e.g. +919876543210.";
  if (message.includes("slot_minutes_check")) return "Session length must be 15, 30, 45 or 60.";
  return message;
}
