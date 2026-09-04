import { NextResponse, type NextRequest } from "next/server";

import { getCoachBySlug } from "@/lib/data/coaches";
import { buildSlotGrid } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open slots for one coach on one date.
 *
 * Returns only free/taken booleans — never who booked what, since that would
 * leak other clients' schedules.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid ?date=YYYY-MM-DD is required." }, { status: 400 });
  }

  const coach = await getCoachBySlug(slug);
  if (!coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin || !coach.id) {
    return NextResponse.json({
      slots: [],
      bookingEnabled: false,
      message: "Online booking is not connected yet — message the coach on WhatsApp instead.",
    });
  }

  const [availability, timeOff, booked] = await Promise.all([
    admin
      .from("coach_availability")
      .select("weekday, start_time, end_time")
      .eq("coach_id", coach.id),
    admin.from("coach_time_off").select("from_date, to_date").eq("coach_id", coach.id),
    admin
      .from("bookings")
      .select("slot_start")
      .eq("coach_id", coach.id)
      .eq("slot_date", date)
      .neq("status", "cancelled"),
  ]);

  const slots = buildSlotGrid({
    date,
    slotMinutes: coach.slotMinutes,
    leadTimeMinutes: coach.leadTimeMinutes,
    availability: (availability.data ?? []).map((a) => ({
      weekday: a.weekday as number,
      startTime: String(a.start_time).slice(0, 5),
      endTime: String(a.end_time).slice(0, 5),
    })),
    timeOff: (timeOff.data ?? []).map((t) => ({
      fromDate: t.from_date as string,
      toDate: t.to_date as string,
    })),
    taken: (booked.data ?? []).map((b) => String(b.slot_start)),
    now: new Date(),
    timezone: coach.timezone,
  });

  return NextResponse.json({ slots, bookingEnabled: true });
}
