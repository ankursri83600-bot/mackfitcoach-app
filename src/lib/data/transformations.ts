import "server-only";

import { TRANSFORMATIONS as STATIC_TRANSFORMATIONS, type Transformation } from "@/lib/data/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicStorageUrl } from "@/lib/supabase/config";

/**
 * Published transformations, falling back to the labelled sample set.
 *
 * The DB query relies on the RLS policy requiring BOTH is_published and
 * consent_on_file, so a story cannot go live until consent is recorded.
 */
export async function listTransformations(): Promise<Transformation[]> {
  const admin = createAdminClient();
  if (!admin) return [...STATIC_TRANSFORMATIONS];

  const { data, error } = await admin
    .from("transformations")
    .select(
      "slug, client_name, display_name, goal, weeks, start_weight_kg, end_weight_kg, before_path, after_path, testimonial",
    )
    .eq("is_published", true)
    .eq("consent_on_file", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return [...STATIC_TRANSFORMATIONS];

  const GOAL_LABELS: Record<string, string> = {
    fat_loss: "Fat loss",
    muscle_gain: "Muscle gain",
    maintenance: "Recomposition",
  };

  return data.map((row) => ({
    slug: row.slug as string,
    // Prefer the public-safe display name.
    displayName: (row.display_name as string) || (row.client_name as string),
    goalLabel: GOAL_LABELS[row.goal as string] ?? (row.goal as string),
    weeks: row.weeks as number,
    startKg: Number(row.start_weight_kg ?? 0),
    endKg: Number(row.end_weight_kg ?? 0),
    beforeSrc: publicStorageUrl("transformations", row.before_path as string),
    afterSrc: publicStorageUrl("transformations", row.after_path as string),
    testimonial: (row.testimonial as string) ?? "",
  }));
}

/** True when the gallery is showing the built-in samples, not real clients. */
export async function isShowingSamples(): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;

  const { count } = await admin
    .from("transformations")
    .select("slug", { count: "exact", head: true })
    .eq("is_published", true)
    .eq("consent_on_file", true);

  return (count ?? 0) === 0;
}
