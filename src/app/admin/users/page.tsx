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
import { getUsers, isDemoMode } from "@/lib/admin/queries";
import { formatDateIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — people" };

export default async function AdminUsersPage() {
  const demo = isDemoMode();
  const { rows } = await getUsers();

  const counts = rows.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeading title="PEOPLE" subtitle={`${rows.length} account${rows.length === 1 ? "" : "s"}`} />

      {demo ? <DemoBanner /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Clients" value={String(counts.user ?? 0)} />
        <StatTile label="Dieticians" value={String(counts.dietician ?? 0)} tone="good" />
        <StatTile label="Trainers" value={String(counts.trainer ?? 0)} tone="good" />
        <StatTile label="Admins" value={String(counts.admin ?? 0)} tone="warn" hint="Full access" />
      </section>

      <div className="mb-8 mt-8 rounded-md border border-hairline bg-surface p-5">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-bone">
          Changing someone&apos;s role
        </p>
        <p className="mt-2 max-w-3xl text-caption leading-relaxed text-ash">
          Roles are deliberately not editable from this screen. A database trigger silently reverts
          any role change that does not come from an admin, so privilege escalation is blocked at the
          data layer rather than trusted to the UI. To promote someone, run this in the Supabase SQL
          editor:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-sm border border-hairline-hi bg-ink px-4 py-3 font-mono text-[0.7rem] text-ash">
          <code>{`update profiles set role = 'dietician' where id = '<user-uuid>';`}</code>
        </pre>
      </div>

      {rows.length === 0 ? (
        <EmptyState>No accounts yet.</EmptyState>
      ) : (
        <TableShell head={["Joined", "Name", "Phone", "Role", "User ID"]} minWidth="56rem">
          {rows.map((user) => (
            <Row key={user.id}>
              <Cell numeric muted>
                {formatDateIST(user.created_at)}
              </Cell>
              <Cell>{user.full_name ?? "—"}</Cell>
              <Cell numeric muted>
                {user.phone ?? "—"}
              </Cell>
              <Cell>
                <StatusPill value={user.role} />
              </Cell>
              <Cell numeric muted className="text-[0.66rem]">
                {user.id}
              </Cell>
            </Row>
          ))}
        </TableShell>
      )}
    </>
  );
}
