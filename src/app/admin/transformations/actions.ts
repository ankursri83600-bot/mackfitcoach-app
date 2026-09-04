"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Publish / unpublish a transformation.
 *
 * Admin-only (not merely staff): this decides what real client photos appear on
 * the public site.
 */
export async function toggleTransformation(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("transformations")
    .update({ is_published: published })
    .eq("id", id);

  if (error) console.error("[admin] toggleTransformation failed", error);

  revalidatePath("/admin/transformations");
  revalidatePath("/transformations");
  revalidatePath("/");
}
