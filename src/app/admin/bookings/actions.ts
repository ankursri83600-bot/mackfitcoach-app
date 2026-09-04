"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Moves a booking through its lifecycle.
 *
 * requireStaff() first — the RPC also checks is_staff(), but the action must not
 * rely solely on the database for authorisation.
 */
export async function setBookingStatus(formData: FormData) {
  await requireStaff();

  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;

  if (!bookingId || !["requested", "confirmed", "completed", "cancelled"].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.rpc("set_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
    p_reason: reason,
  });

  if (error) console.error("[admin] set_booking_status failed", error);

  revalidatePath("/admin/bookings");
}
