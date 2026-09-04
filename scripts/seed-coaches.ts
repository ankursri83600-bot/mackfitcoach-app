/**
 * Seeds coaches, their contact numbers and weekly availability.
 *
 *   npx tsx scripts/seed-coaches.ts
 *
 * Idempotent: upserts on slug, so re-running updates rather than duplicating.
 * Requires SUPABASE_SERVICE_ROLE_KEY, since it writes through RLS-bypassing paths.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader so this runs without extra dependencies.
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("your-project-ref")) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const COACHES = [
  {
    slug: "mack",
    name: "Coach Mack",
    kind: "trainer" as const,
    headline: "Head coach and founder",
    bio: "Twelve years on the gym floor, from first-time lifters to stage-ready physiques. Builds plans around what you can actually sustain.",
    specialties: ["Body recomposition", "Strength", "Contest prep"],
    slot_minutes: 30,
    phone: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+919999999999",
    // Mon-Sat mornings and evenings.
    availability: [
      ...[0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: "07:00", end_time: "10:00" })),
      ...[0, 2, 4].map((weekday) => ({ weekday, start_time: "18:00", end_time: "21:00" })),
    ],
  },
  {
    slug: "dietician",
    name: "Dr. Sneha Verma",
    kind: "dietician" as const,
    headline: "Clinical dietician, RD",
    bio: "Registered dietician specialising in Indian household nutrition, PCOS and thyroid-friendly planning, and diabetic-safe fat loss.",
    specialties: ["PCOS", "Thyroid", "Diabetic-safe plans"],
    slot_minutes: 45,
    phone: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+919999999999",
    availability: [1, 3, 5].map((weekday) => ({
      weekday,
      start_time: "11:00",
      end_time: "16:00",
    })),
  },
  {
    slug: "trainer",
    name: "Vikram Rao",
    kind: "trainer" as const,
    headline: "Strength and conditioning",
    bio: "Ex-athlete turned coach. Handles form correction over video and programming for home or crowded local gyms.",
    specialties: ["Home workouts", "Form correction", "Mobility"],
    slot_minutes: 30,
    phone: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+919999999999",
    availability: [1, 2, 3, 4].map((weekday) => ({
      weekday,
      start_time: "17:00",
      end_time: "20:00",
    })),
  },
];

async function main() {
  for (const [index, coach] of COACHES.entries()) {
    const { data, error } = await db
      .from("coaches")
      .upsert(
        {
          slug: coach.slug,
          name: coach.name,
          kind: coach.kind,
          headline: coach.headline,
          bio: coach.bio,
          specialties: coach.specialties,
          slot_minutes: coach.slot_minutes,
          is_active: true,
          sort_order: index,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (error || !data) {
      console.error(`✗ ${coach.slug}:`, error?.message);
      continue;
    }

    await db
      .from("coach_contacts")
      .upsert({ coach_id: data.id, phone_e164: coach.phone }, { onConflict: "coach_id" });

    // Replace availability wholesale so re-seeding is deterministic.
    await db.from("coach_availability").delete().eq("coach_id", data.id);
    await db
      .from("coach_availability")
      .insert(coach.availability.map((a) => ({ ...a, coach_id: data.id })));

    console.log(`→ ${coach.name} (${coach.availability.length} availability windows)`);
  }

  console.log("\n✓ coaches seeded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
