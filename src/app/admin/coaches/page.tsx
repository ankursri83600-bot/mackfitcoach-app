import type { Metadata } from "next";

import {
  DemoBanner,
  DetailGrid,
  EmptyState,
  PageHeading,
  SectionCard,
  StatusPill,
} from "@/components/admin/ui";
import { getCoaches, isDemoMode } from "@/lib/admin/queries";
import { WEEKDAY_LABEL } from "@/lib/diet/constants";
import { formatTime24to12 } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — coaches" };

export default async function AdminCoachesPage() {
  const demo = isDemoMode();
  const { rows } = await getCoaches();

  return (
    <>
      <PageHeading
        title="COACHES"
        subtitle="Who takes bookings, when they work, and how clients reach them."
      />

      {demo ? <DemoBanner /> : null}

      <div className="mb-8 rounded-md border border-hairline bg-surface p-5">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-bone">
          Where the phone numbers live
        </p>
        <p className="mt-2 max-w-3xl text-caption leading-relaxed text-ash">
          Coach numbers are stored in a separate <code className="text-bone">coach_contacts</code>{" "}
          table readable only by staff — not as a column on the public coaches record. Row-level
          security cannot protect a single column, so a public{" "}
          <code className="text-bone">coaches.phone</code> would hand every coach&apos;s mobile to
          anyone holding the public API key. Clients only ever receive the number baked into a
          WhatsApp link, for a booking they own.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          No coaches yet. Run <code className="text-bone">npm run seed:coaches</code> to create the
          starter three with their weekly availability.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {rows.map((coach) => (
            <SectionCard
              key={coach.id}
              title={coach.name}
              action={<StatusPill value={coach.is_active ? "confirmed" : "cancelled"} />}
            >
              <DetailGrid
                items={[
                  { label: "Role", value: coach.kind },
                  { label: "Headline", value: coach.headline ?? "—" },
                  { label: "Session length", value: `${coach.slot_minutes} minutes` },
                  { label: "Minimum notice", value: `${coach.lead_time_minutes / 60} hours` },
                  { label: "WhatsApp", value: coach.phone ?? "Not set" },
                  { label: "URL slug", value: `/coaches/${coach.slug}` },
                ]}
              />

              <div className="mt-6">
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-ash-dim">
                  Weekly availability
                </p>
                {coach.windows.length === 0 ? (
                  <p className="mt-2 text-caption text-warn">
                    No availability set — this coach cannot be booked.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {coach.windows.map((w, i) => (
                      <li
                        key={`${w.weekday}-${w.start_time}-${i}`}
                        className="rounded-sm border border-hairline-hi px-3 py-1.5 font-mono text-[0.68rem] tabular-nums text-ash"
                      >
                        <span className="text-bone">{WEEKDAY_LABEL[w.weekday].slice(0, 3)}</span>{" "}
                        {formatTime24to12(w.start_time)} – {formatTime24to12(w.end_time)}
                      </li>
                    ))}
                  </ul>
                )}
                {coach.windows.length > 0 ? (
                  <p className="mt-3 text-[0.68rem] leading-relaxed text-ash-dim">
                    Individual slots are derived from these windows at request time, so changing a
                    window instantly changes what clients can book — there are no pre-generated slot
                    rows to clean up.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </>
  );
}
