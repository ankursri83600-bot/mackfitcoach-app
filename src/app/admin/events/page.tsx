import type { Metadata } from "next";

import {
  Cell,
  DemoBanner,
  EmptyState,
  PageHeading,
  Row,
  StatTile,
  TableShell,
} from "@/components/admin/ui";
import { getPaymentEvents, isDemoMode } from "@/lib/admin/queries";
import { formatDateIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — payment log" };

export default async function AdminEventsPage() {
  const demo = isDemoMode();
  const { rows } = await getPaymentEvents(200);

  const withErrors = rows.filter((e) => e.handler_error);
  const unhandled = rows.filter((e) => !e.handled);

  return (
    <>
      <PageHeading
        title="PAYMENT LOG"
        subtitle="Every webhook Razorpay has sent us, in the order it arrived."
      />

      {demo ? <DemoBanner /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Events received" value={String(rows.length)} />
        <StatTile
          label="Refused or errored"
          value={String(withErrors.length)}
          tone={withErrors.length ? "bad" : "good"}
          hint="Recorded, never silently dropped"
        />
        <StatTile
          label="Not yet handled"
          value={String(unhandled.length)}
          tone={unhandled.length ? "warn" : "good"}
        />
      </section>

      <div className="mb-8 mt-8 rounded-md border border-hairline bg-surface p-5">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-bone">
          Why this log exists
        </p>
        <p className="mt-2 max-w-3xl text-caption leading-relaxed text-ash">
          Razorpay can deliver the same event more than once, and the webhook is the source of truth
          for whether someone has paid. Every delivery is recorded here under its event id before
          anything is acted on, so a repeat delivery is recognised and ignored rather than granting
          access twice. A refused settlement — a capture whose amount did not match what we asked for
          — is written here with the reason instead of disappearing.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          No webhook events yet. They start arriving once Razorpay is configured and a payment is
          attempted.
        </EmptyState>
      ) : (
        <TableShell head={["Received", "Event", "Event ID", "Handled", "Error"]} minWidth="62rem">
          {rows.map((event) => (
            <Row key={event.id}>
              <Cell numeric muted>
                {formatDateIST(event.created_at)}
              </Cell>
              <Cell>
                <span className="font-mono text-[0.72rem]">{event.event}</span>
              </Cell>
              <Cell numeric muted className="text-[0.68rem]">
                {event.razorpay_event_id}
              </Cell>
              <Cell muted>{event.handled ? "yes" : "no"}</Cell>
              <Cell className="max-w-sm">
                {event.handler_error ? (
                  <span className="text-[0.7rem] leading-snug text-blood-bright">
                    {event.handler_error}
                  </span>
                ) : (
                  <span className="text-ash-dim">—</span>
                )}
              </Cell>
            </Row>
          ))}
        </TableShell>
      )}
    </>
  );
}
