import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isRazorpayConfigured, hasWebhookSecret, razorpayConfigStatus } from "@/lib/razorpay";
import {
  DEMO_BOOKINGS,
  DEMO_EVENTS,
  DEMO_INTAKES,
  DEMO_ORDERS,
  DEMO_TRANSFORMATIONS,
  DEMO_USERS,
} from "./demo-data";

/**
 * Admin data access.
 *
 * Every function returns `{ demo, rows }`. When Supabase is not configured the
 * console renders sample rows so the screens are inspectable before a database
 * exists; `demo` is surfaced in the UI so those numbers are never mistaken for
 * real ones. Once Supabase IS configured, only real data is ever returned.
 */
export function isDemoMode() {
  return !isSupabaseConfigured() || !createAdminClient();
}

export interface AdminResult<T> {
  demo: boolean;
  rows: T[];
}

export async function getOrders(limit = 100): Promise<AdminResult<(typeof DEMO_ORDERS)[number]>> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_ORDERS };

  const { data } = await admin
    .from("orders")
    .select(
      "id, email, tier_name_snapshot, tier_slug, amount_paise, status, razorpay_payment_id, reconciliation_error, created_at, paid_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return { demo: false, rows: (data ?? []) as (typeof DEMO_ORDERS)[number][] };
}

export async function getIntakes(limit = 100): Promise<AdminResult<(typeof DEMO_INTAKES)[number]>> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_INTAKES };

  const { data } = await admin
    .from("diet_requests")
    .select(
      "id, full_name, email, phone, age, gender, height_cm, weight_kg, activity, goal, diet_type, nonveg_days, exclude_tags, meals_per_day, bmi, bmi_category, bmr_kcal, tdee_kcal, target_kcal, protein_g, carbs_g, fat_g, medical_notes, status, created_at, diet_plans(id)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []).map((row) => {
    const plans = (row.diet_plans as { id: string }[] | null) ?? [];
    return { ...row, plan_id: plans[0]?.id ?? null };
  });

  return { demo: false, rows: rows as unknown as (typeof DEMO_INTAKES)[number][] };
}

export async function getIntake(id: string) {
  const admin = createAdminClient();
  if (!admin) {
    return { demo: true, row: DEMO_INTAKES.find((i) => i.id === id) ?? null };
  }

  const { data } = await admin
    .from("diet_requests")
    .select("*, diet_plans(id, created_at, engine_version)")
    .eq("id", id)
    .maybeSingle();

  return { demo: false, row: data as unknown as (typeof DEMO_INTAKES)[number] | null };
}

export async function getBookings(
  limit = 100,
): Promise<AdminResult<(typeof DEMO_BOOKINGS)[number]>> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_BOOKINGS };

  const { data } = await admin
    .from("bookings")
    .select(
      "id, name, email, phone, slot_date, slot_start, status, mode, topic, preferred_time, coaches(name, kind)",
    )
    .order("slot_date", { ascending: false })
    .limit(limit);

  return { demo: false, rows: (data ?? []) as unknown as (typeof DEMO_BOOKINGS)[number][] };
}

export async function getPaymentEvents(
  limit = 100,
): Promise<AdminResult<(typeof DEMO_EVENTS)[number]>> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_EVENTS };

  const { data } = await admin
    .from("payment_events")
    .select("id, razorpay_event_id, event, handled, handler_error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return { demo: false, rows: (data ?? []) as (typeof DEMO_EVENTS)[number][] };
}

export async function getUsers(limit = 200): Promise<AdminResult<(typeof DEMO_USERS)[number]>> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_USERS };

  const { data } = await admin
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return { demo: false, rows: (data ?? []) as (typeof DEMO_USERS)[number][] };
}

export async function getTransformations(): Promise<
  AdminResult<(typeof DEMO_TRANSFORMATIONS)[number]>
> {
  const admin = createAdminClient();
  if (!admin) return { demo: true, rows: DEMO_TRANSFORMATIONS };

  const { data } = await admin
    .from("transformations")
    .select(
      "id, slug, client_name, display_name, goal, weeks, start_weight_kg, end_weight_kg, is_published, consent_on_file",
    )
    .order("sort_order", { ascending: true });

  return { demo: false, rows: (data ?? []) as (typeof DEMO_TRANSFORMATIONS)[number][] };
}

export interface CoachRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  headline: string | null;
  slot_minutes: number;
  lead_time_minutes: number;
  is_active: boolean;
  phone: string | null;
  windows: { weekday: number; start_time: string; end_time: string }[];
}

export async function getCoaches(): Promise<AdminResult<CoachRow>> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      demo: true,
      rows: [
        {
          id: "demo-1",
          slug: "mack",
          name: "Coach Mack",
          kind: "trainer",
          headline: "Head coach and founder",
          slot_minutes: 30,
          lead_time_minutes: 120,
          is_active: true,
          phone: "+919000000010",
          windows: [
            { weekday: 0, start_time: "07:00", end_time: "10:00" },
            { weekday: 2, start_time: "07:00", end_time: "10:00" },
            { weekday: 4, start_time: "18:00", end_time: "21:00" },
          ],
        },
        {
          id: "demo-2",
          slug: "dietician",
          name: "Dr. Sneha Verma",
          kind: "dietician",
          headline: "Clinical dietician, RD",
          slot_minutes: 45,
          lead_time_minutes: 120,
          is_active: true,
          phone: "+919000000011",
          windows: [
            { weekday: 1, start_time: "11:00", end_time: "16:00" },
            { weekday: 3, start_time: "11:00", end_time: "16:00" },
          ],
        },
        {
          id: "demo-3",
          slug: "trainer",
          name: "Vikram Rao",
          kind: "trainer",
          headline: "Strength and conditioning",
          slot_minutes: 30,
          lead_time_minutes: 120,
          is_active: true,
          phone: "+919000000012",
          windows: [{ weekday: 2, start_time: "17:00", end_time: "20:00" }],
        },
      ],
    };
  }

  const [coaches, contacts, availability] = await Promise.all([
    admin
      .from("coaches")
      .select("id, slug, name, kind, headline, slot_minutes, lead_time_minutes, is_active")
      .order("sort_order", { ascending: true }),
    admin.from("coach_contacts").select("coach_id, phone_e164"),
    admin.from("coach_availability").select("coach_id, weekday, start_time, end_time"),
  ]);

  const phoneByCoach = new Map(
    (contacts.data ?? []).map((c) => [c.coach_id as string, c.phone_e164 as string]),
  );

  const rows: CoachRow[] = (coaches.data ?? []).map((c) => ({
    id: c.id as string,
    slug: c.slug as string,
    name: c.name as string,
    kind: c.kind as string,
    headline: (c.headline as string) ?? null,
    slot_minutes: c.slot_minutes as number,
    lead_time_minutes: c.lead_time_minutes as number,
    is_active: c.is_active as boolean,
    phone: phoneByCoach.get(c.id as string) ?? null,
    windows: (availability.data ?? [])
      .filter((a) => a.coach_id === c.id)
      .map((a) => ({
        weekday: a.weekday as number,
        start_time: String(a.start_time).slice(0, 5),
        end_time: String(a.end_time).slice(0, 5),
      }))
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
  }));

  return { demo: false, rows };
}

/** Integration + configuration status, for the System screen. */
export function getSystemStatus() {
  return {
    supabase: isSupabaseConfigured(),
    serviceRole: Boolean(createAdminClient()),
    razorpay: isRazorpayConfigured(),
    webhook: hasWebhookSecret(),
    // Named variables, so the screen can say exactly what is outstanding.
    razorpayDetail: razorpayConfigStatus(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    nodeEnv: process.env.NODE_ENV,
  };
}
