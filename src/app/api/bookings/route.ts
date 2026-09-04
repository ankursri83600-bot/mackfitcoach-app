import { NextResponse, type NextRequest } from "next/server";

import { getCoachBySlug } from "@/lib/data/coaches";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Maps the RPC's named exceptions to something a human can act on. */
const REASONS: Record<string, { status: number; message: string }> = {
  coach_unavailable: { status: 404, message: "That coach is not taking bookings." },
  slot_outside_availability: { status: 400, message: "That time is outside the coach's hours." },
  slot_off_grid: { status: 400, message: "Please pick one of the offered time slots." },
  coach_on_leave: { status: 400, message: "The coach is on leave that day." },
  slot_too_soon: { status: 400, message: "That slot is too soon — please pick a later one." },
  slot_too_far: { status: 400, message: "That date is too far ahead." },
};

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Online booking is not connected yet. Please message us on WhatsApp." },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`booking:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let body: {
    coachSlug?: string;
    slotDate?: string;
    slotStart?: string;
    name?: string;
    email?: string;
    phone?: string;
    topic?: string;
    preferredTime?: string;
    mode?: string;
    planId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const required = ["coachSlug", "slotDate", "slotStart", "name", "email", "phone"] as const;
  for (const field of required) {
    if (!body[field] || String(body[field]).trim().length === 0) {
      return NextResponse.json({ error: `Missing ${field}.` }, { status: 400 });
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.slotDate!) || !/^\d{2}:\d{2}$/.test(body.slotStart!)) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }

  const coach = await getCoachBySlug(body.coachSlug!);
  if (!coach?.id) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const user = await getCurrentUser();

  const { data: bookingId, error } = await admin.rpc("book_slot", {
    p_user_id: user?.id ?? null,
    p_coach_id: coach.id,
    p_slot_date: body.slotDate,
    p_slot_start: body.slotStart,
    p_mode: body.mode === "phone" ? "phone" : body.mode === "video" ? "video" : "whatsapp",
    p_name: body.name!.trim(),
    p_email: body.email!.trim(),
    p_phone: body.phone!.trim(),
    p_topic: body.topic?.trim() || null,
    p_preferred_time: body.preferredTime?.trim() || null,
    p_diet_request_id: null,
  });

  if (error) {
    // 23505 is the partial unique index on (coach, date, start) — the
    // double-booking guard firing. Exactly one concurrent request can win.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That slot was just taken — please pick another." },
        { status: 409 },
      );
    }

    const known = Object.keys(REASONS).find((key) => error.message.includes(key));
    if (known) {
      return NextResponse.json({ error: REASONS[known].message }, { status: REASONS[known].status });
    }

    console.error("[booking] book_slot failed", error);
    return NextResponse.json({ error: "Could not complete the booking." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookingId, redirect: `/book/${bookingId}` });
}
