import type { Metadata } from "next";

import {
  DemoBanner,
  EmptyState,
  PageHeading,
  SectionCard,
  StatTile,
  StatusPill,
} from "@/components/admin/ui";
import { getBookings, isDemoMode } from "@/lib/admin/queries";
import { formatDateIST, formatTime24to12 } from "@/lib/utils";

import { setBookingStatus } from "./actions";

export const metadata: Metadata = { title: "Admin — bookings" };

export default async function AdminBookingsPage() {
  const demo = isDemoMode();
  const { rows } = await getBookings(200);

  const counts = rows.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeading
        title="BOOKINGS"
        subtitle="Confirm a slot to let the client know it is locked in."
      />

      {demo ? (
        <DemoBanner>
          Supabase is not connected, so these are sample bookings and the status buttons are
          inactive. Connect Supabase to manage real sessions.
        </DemoBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting you"
          value={String(counts.requested ?? 0)}
          tone={counts.requested ? "warn" : "good"}
          hint="Client is waiting on confirmation"
        />
        <StatTile label="Confirmed" value={String(counts.confirmed ?? 0)} tone="good" />
        <StatTile label="Completed" value={String(counts.completed ?? 0)} />
        <StatTile label="Cancelled" value={String(counts.cancelled ?? 0)} />
      </section>

      <div className="mt-8 grid gap-4">
        {rows.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          rows.map((booking) => (
            <SectionCard
              key={booking.id}
              title={`${booking.name} → ${booking.coaches?.name ?? "coach"}`}
              action={<StatusPill value={booking.status} />}
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-56 space-y-2">
                  <p className="font-mono text-caption tabular-nums text-bone">
                    {formatDateIST(booking.slot_date)} ·{" "}
                    {formatTime24to12(String(booking.slot_start).slice(0, 5))} IST
                  </p>
                  <p className="text-[0.7rem] text-ash">
                    {booking.coaches?.kind ?? "coach"} · via {booking.mode}
                  </p>
                  <p className="text-[0.7rem] text-ash-dim">
                    {booking.email} · {booking.phone}
                  </p>
                  {booking.preferred_time ? (
                    <p className="text-[0.7rem] text-ash">
                      <span className="text-ash-dim">Prefers:</span> {booking.preferred_time}
                    </p>
                  ) : null}
                </div>

                {booking.topic ? (
                  <p className="max-w-md flex-1 border-l-2 border-hairline-hi pl-4 text-caption italic leading-relaxed text-ash">
                    “{booking.topic}”
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {(["confirmed", "completed", "cancelled"] as const)
                    .filter((s) => s !== booking.status)
                    .map((status) => (
                      <form key={status} action={setBookingStatus}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="status" value={status} />
                        <button
                          type="submit"
                          disabled={demo}
                          className="rounded-pill border border-hairline-hi px-4 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.14em] text-ash transition-colors hover:border-blood hover:text-blood-bright disabled:pointer-events-none disabled:opacity-40"
                        >
                          Mark {status}
                        </button>
                      </form>
                    ))}
                </div>
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </>
  );
}
