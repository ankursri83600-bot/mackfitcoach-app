import type { Metadata } from "next";

import {
  Cell,
  DemoBanner,
  EmptyState,
  PageHeading,
  Row,
  StatTile,
  StatusPill,
  TableShell,
} from "@/components/admin/ui";
import { getOrders, isDemoMode } from "@/lib/admin/queries";
import { formatDateIST, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — orders" };

export default async function AdminOrdersPage() {
  const demo = isDemoMode();
  const { rows } = await getOrders(200);

  const byStatus = rows.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const collected = rows
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + o.amount_paise, 0);
  const refunded = rows
    .filter((o) => o.status === "refunded")
    .reduce((s, o) => s + o.amount_paise, 0);
  const atRisk = rows
    .filter((o) => o.status === "mismatch")
    .reduce((s, o) => s + o.amount_paise, 0);

  return (
    <>
      <PageHeading
        title="ORDERS"
        subtitle={`${rows.length} order${rows.length === 1 ? "" : "s"} · newest first`}
      />

      {demo ? <DemoBanner /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Collected" value={formatINR(collected)} tone="good" hint={`${byStatus.paid ?? 0} paid`} />
        <StatTile label="Refunded" value={formatINR(refunded)} tone={refunded ? "warn" : "neutral"} hint={`${byStatus.refunded ?? 0} refunds`} />
        <StatTile
          label="Held in mismatch"
          value={formatINR(atRisk)}
          tone={atRisk ? "bad" : "good"}
          hint="Captured but not granted"
        />
        <StatTile
          label="Not completed"
          value={String((byStatus.created ?? 0) + (byStatus.failed ?? 0))}
          tone={byStatus.failed ? "warn" : "neutral"}
          hint="Abandoned or declined"
        />
      </section>

      <div className="mt-8">
        {rows.length === 0 ? (
          <EmptyState>
            No orders yet. They appear here the moment a Razorpay order is created — before payment,
            so you can see abandoned checkouts too.
          </EmptyState>
        ) : (
          <TableShell
            head={["Created", "Customer", "Plan", "Amount", "Status", "Payment ref", "Notes"]}
            minWidth="68rem"
          >
            {rows.map((order) => (
              <Row key={order.id}>
                <Cell numeric muted>
                  {formatDateIST(order.created_at)}
                </Cell>
                <Cell>{order.email}</Cell>
                <Cell muted>{order.tier_name_snapshot}</Cell>
                <Cell numeric>{formatINR(order.amount_paise)}</Cell>
                <Cell>
                  <StatusPill value={order.status} />
                </Cell>
                <Cell numeric muted className="text-[0.7rem]">
                  {order.razorpay_payment_id ?? "—"}
                </Cell>
                <Cell className="max-w-xs">
                  {order.reconciliation_error ? (
                    <span className="text-[0.7rem] leading-snug text-blood-bright">
                      {order.reconciliation_error}
                    </span>
                  ) : (
                    <span className="text-ash-dim">—</span>
                  )}
                </Cell>
              </Row>
            ))}
          </TableShell>
        )}
      </div>
    </>
  );
}
