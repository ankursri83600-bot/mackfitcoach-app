import type { Metadata } from "next";
import Link from "next/link";

import {
  Cell,
  DemoBanner,
  PageHeading,
  Row,
  SectionCard,
  StatTile,
  StatusPill,
  TableShell,
} from "@/components/admin/ui";
import {
  getBookings,
  getIntakes,
  getOrders,
  getSystemStatus,
  isDemoMode,
} from "@/lib/admin/queries";
import { formatDateIST, formatINR, formatTime24to12 } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — overview" };

export default async function AdminOverviewPage() {
  const demo = isDemoMode();
  const [orders, intakes, bookings] = await Promise.all([
    getOrders(200),
    getIntakes(200),
    getBookings(200),
  ]);
  const status = getSystemStatus();

  const paid = orders.rows.filter((o) => o.status === "paid");
  const revenuePaise = paid.reduce((sum, o) => sum + o.amount_paise, 0);
  const mismatched = orders.rows.filter((o) => o.status === "mismatch");
  const failed = orders.rows.filter((o) => o.status === "failed");
  const pendingBookings = bookings.rows.filter((b) => b.status === "requested");
  const withMedicalNotes = intakes.rows.filter((i) => i.medical_notes);

  // Conversion is the number that actually tells him whether the funnel works.
  const conversion = intakes.rows.length
    ? Math.round((paid.length / intakes.rows.length) * 100)
    : 0;

  const avgOrderPaise = paid.length ? Math.round(revenuePaise / paid.length) : 0;

  return (
    <>
      <PageHeading
        title="OVERVIEW"
        subtitle={
          demo
            ? "Illustrative figures — connect Supabase for live numbers."
            : "Everything happening across the business right now."
        }
      />

      {demo ? <DemoBanner /> : null}

      {/* Anything needing attention comes first, before the vanity metrics. */}
      {mismatched.length > 0 ? (
        <div className="mb-8 rounded-md border border-blood/60 bg-blood/10 p-5">
          <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-blood-bright">
            {mismatched.length} payment{mismatched.length === 1 ? "" : "s"} need reconciliation
          </p>
          <p className="mt-2 max-w-2xl text-caption leading-relaxed text-ash">
            A capture disagreed with the amount we asked for, so it was refused rather than settled.
            These never granted access and may need refunding.{" "}
            <Link href="/admin/orders" className="text-blood-bright underline">
              Review orders
            </Link>
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Revenue collected"
          value={formatINR(revenuePaise)}
          hint={`${paid.length} paid order${paid.length === 1 ? "" : "s"}`}
          tone={revenuePaise > 0 ? "good" : "neutral"}
        />
        <StatTile
          label="Average order"
          value={avgOrderPaise ? formatINR(avgOrderPaise) : "—"}
          hint="Across paid orders"
        />
        <StatTile
          label="Intake → paid"
          value={`${conversion}%`}
          hint={`${intakes.rows.length} charts generated`}
        />
        <StatTile
          label="Awaiting confirmation"
          value={String(pendingBookings.length)}
          hint="Bookings you have not accepted"
          tone={pendingBookings.length > 0 ? "warn" : "good"}
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Failed payments"
          value={String(failed.length)}
          hint="Card declined or abandoned"
          tone={failed.length > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label="Needs mismatch review"
          value={String(mismatched.length)}
          tone={mismatched.length > 0 ? "bad" : "good"}
          hint={mismatched.length ? "Money captured, access withheld" : "All settled cleanly"}
        />
        <StatTile
          label="Medical notes flagged"
          value={String(withMedicalNotes.length)}
          hint="Intakes wanting a dietician's eyes"
          tone={withMedicalNotes.length > 0 ? "warn" : "neutral"}
        />
        <StatTile
          label="Integrations live"
          value={`${[status.supabase, status.razorpay, status.webhook].filter(Boolean).length}/3`}
          hint="Supabase · Razorpay · webhook"
          tone={status.supabase && status.razorpay && status.webhook ? "good" : "warn"}
        />
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Latest orders"
          action={
            <Link
              href="/admin/orders"
              className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-blood-bright hover:underline"
            >
              All orders
            </Link>
          }
        >
          {orders.rows.length === 0 ? (
            <p className="text-caption text-ash">No orders yet.</p>
          ) : (
            <TableShell head={["Customer", "Plan", "Amount", "Status"]} minWidth="34rem">
              {orders.rows.slice(0, 6).map((order) => (
                <Row key={order.id}>
                  <Cell muted>{order.email}</Cell>
                  <Cell>{order.tier_name_snapshot}</Cell>
                  <Cell numeric>{formatINR(order.amount_paise)}</Cell>
                  <Cell>
                    <StatusPill value={order.status} />
                  </Cell>
                </Row>
              ))}
            </TableShell>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming sessions"
          action={
            <Link
              href="/admin/bookings"
              className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-blood-bright hover:underline"
            >
              All bookings
            </Link>
          }
        >
          {bookings.rows.length === 0 ? (
            <p className="text-caption text-ash">No bookings yet.</p>
          ) : (
            <TableShell head={["Client", "Coach", "When", "Status"]} minWidth="34rem">
              {bookings.rows.slice(0, 6).map((booking) => (
                <Row key={booking.id}>
                  <Cell>{booking.name}</Cell>
                  <Cell muted>{booking.coaches?.name ?? "—"}</Cell>
                  <Cell numeric muted>
                    {formatDateIST(booking.slot_date)}{" "}
                    {formatTime24to12(String(booking.slot_start).slice(0, 5))}
                  </Cell>
                  <Cell>
                    <StatusPill value={booking.status} />
                  </Cell>
                </Row>
              ))}
            </TableShell>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Newest intakes"
          action={
            <Link
              href="/admin/diet-requests"
              className="font-display text-[0.65rem] uppercase tracking-[0.14em] text-blood-bright hover:underline"
            >
              All intakes
            </Link>
          }
        >
          {intakes.rows.length === 0 ? (
            <p className="text-caption text-ash">No intakes yet.</p>
          ) : (
            <TableShell
              head={["Name", "Body", "Goal", "Diet", "Target", "Status", ""]}
              minWidth="52rem"
            >
              {intakes.rows.slice(0, 6).map((intake) => (
                <Row key={intake.id}>
                  <Cell>{intake.full_name ?? "Guest"}</Cell>
                  <Cell numeric muted>
                    {intake.age}y · {intake.height_cm}cm · {intake.weight_kg}kg · BMI {intake.bmi}
                  </Cell>
                  <Cell muted>{String(intake.goal).replace(/_/g, " ")}</Cell>
                  <Cell muted>{String(intake.diet_type).replace("_", "-")}</Cell>
                  <Cell numeric>{intake.target_kcal} kcal</Cell>
                  <Cell>
                    <StatusPill value={intake.status} />
                  </Cell>
                  <Cell>
                    <Link
                      href={`/admin/diet-requests/${intake.id}`}
                      className="font-display text-[0.62rem] uppercase tracking-[0.14em] text-blood-bright hover:underline"
                    >
                      Open
                    </Link>
                  </Cell>
                </Row>
              ))}
            </TableShell>
          )}
        </SectionCard>
      </div>
    </>
  );
}
