"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transformation CRUD.
 *
 * These rows are photographs of a real person's body on a public website, so
 * two things are treated as load-bearing rather than as form fields:
 *
 *   - `consent_on_file` can only be set from a form that states what is being
 *     attested. The database policy also requires it for public reads, so this
 *     screen is the second lock, not the only one.
 *   - Deleting a row does NOT delete the storage objects. Those are removed
 *     explicitly, and only after the row is gone, so a failed delete can never
 *     leave a published row pointing at a missing image.
 */
export type CrudResult = { ok: boolean; error?: string };

function revalidateGallery() {
  revalidatePath("/admin/transformations");
  revalidatePath("/transformations");
  revalidatePath("/");
}

const Schema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens"),
  clientName: z.string().trim().min(2, "Client name is required").max(80),
  displayName: z.string().trim().max(80).optional().or(z.literal("")),
  goal: z.enum(["fat_loss", "muscle_gain", "maintenance"]),
  weeks: z.coerce.number().int().min(1, "Weeks must be at least 1").max(520),
  startWeightKg: z.coerce.number().min(20).max(400),
  endWeightKg: z.coerce.number().min(20).max(400),
  beforePath: z.string().trim().min(1, "Before image path is required").max(300),
  afterPath: z.string().trim().min(1, "After image path is required").max(300),
  testimonial: z.string().trim().max(1200).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999),
  consentOnFile: z.coerce.boolean(),
  isPublished: z.coerce.boolean(),
});

export async function saveTransformation(
  _prev: CrudResult,
  formData: FormData,
): Promise<CrudResult> {
  await requireAdmin();

  const parsed = Schema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    clientName: String(formData.get("clientName") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    goal: String(formData.get("goal") ?? "fat_loss"),
    weeks: String(formData.get("weeks") ?? "12"),
    startWeightKg: String(formData.get("startWeightKg") ?? "0"),
    endWeightKg: String(formData.get("endWeightKg") ?? "0"),
    beforePath: String(formData.get("beforePath") ?? ""),
    afterPath: String(formData.get("afterPath") ?? ""),
    testimonial: String(formData.get("testimonial") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    consentOnFile: formData.get("consentOnFile") === "on",
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  // Belt and braces with the database policy. Catching it here lets us explain
  // WHY, which a bare RLS refusal cannot do.
  if (v.isPublished && !v.consentOnFile) {
    return {
      ok: false,
      error:
        "Cannot publish without consent on file. The database policy enforces this too — tick consent, or leave it unpublished.",
    };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is not configured." };

  const row = {
    slug: v.slug,
    client_name: v.clientName,
    display_name: v.displayName || null,
    goal: v.goal,
    weeks: v.weeks,
    start_weight_kg: v.startWeightKg,
    end_weight_kg: v.endWeightKg,
    before_path: v.beforePath,
    after_path: v.afterPath,
    testimonial: v.testimonial || null,
    sort_order: v.sortOrder,
    consent_on_file: v.consentOnFile,
    is_published: v.isPublished,
  };

  const id = String(formData.get("id") ?? "").trim();
  const { error } = id
    ? await admin.from("transformations").update(row).eq("id", id)
    : await admin.from("transformations").insert(row);

  if (error) {
    return {
      ok: false,
      error: error.message.includes("transformations_slug_key")
        ? "That slug is already taken."
        : error.message,
    };
  }

  revalidateGallery();
  return { ok: true };
}

export async function setConsent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const consent = String(formData.get("consent") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  /**
   * Withdrawing consent must also unpublish.
   *
   * Leaving `is_published` true with consent revoked relies entirely on the
   * read policy's AND to keep the photo off the site. That works today, but it
   * stores a row whose own flags say "publish this", one policy edit away from
   * going live again. Consent withdrawal is exactly the case where that must
   * not be possible.
   */
  const patch = consent
    ? { consent_on_file: true }
    : { consent_on_file: false, is_published: false };

  const { error } = await admin.from("transformations").update(patch).eq("id", id);
  if (error) console.error("[admin] setConsent failed", error);

  revalidateGallery();
}

export async function deleteTransformation(
  _prev: CrudResult,
  formData: FormData,
): Promise<CrudResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is not configured." };

  // Read the object keys BEFORE deleting the row — afterwards they are gone.
  const { data: existing } = await admin
    .from("transformations")
    .select("before_path, after_path")
    .eq("id", id)
    .single();

  const { error } = await admin.from("transformations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Row first, then objects. The other order can leave a published row
  // pointing at a missing image if the delete fails.
  if (existing) {
    const keys = [existing.before_path, existing.after_path].filter(Boolean) as string[];
    if (keys.length) {
      const { error: storageError } = await admin.storage.from("transformations").remove(keys);
      // Not fatal: the row is already gone, so nothing is publicly broken.
      // Orphaned objects are a cleanup task, not an incident.
      if (storageError) console.error("[admin] orphaned storage objects", keys, storageError);
    }
  }

  revalidateGallery();
  return { ok: true };
}
