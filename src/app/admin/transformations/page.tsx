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
import { getTransformations, isDemoMode } from "@/lib/admin/queries";

import { toggleTransformation } from "./actions";

export const metadata: Metadata = { title: "Admin — gallery" };

export default async function AdminTransformationsPage() {
  const demo = isDemoMode();
  const { rows } = await getTransformations();

  const live = rows.filter((r) => r.is_published && r.consent_on_file);
  const noConsent = rows.filter((r) => !r.consent_on_file);

  return (
    <>
      <PageHeading
        title="GALLERY"
        subtitle="Client before/after stories shown on the public site."
      />

      {demo ? <DemoBanner /> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Live on the site" value={String(live.length)} tone="good" />
        <StatTile label="Total stories" value={String(rows.length)} />
        <StatTile
          label="Missing consent"
          value={String(noConsent.length)}
          tone={noConsent.length ? "warn" : "good"}
          hint="Cannot be published"
        />
      </section>

      <div className="mb-8 mt-8 rounded-md border border-hairline bg-surface p-5">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-bone">
          Publishing rules
        </p>
        <p className="mt-2 max-w-3xl text-caption leading-relaxed text-ash">
          A story only appears publicly when it is <span className="text-bone">published</span> and{" "}
          <span className="text-bone">consent is on file</span>. Both conditions are enforced by the
          database policy, not just by this screen, so another client of the API cannot bypass them.
          Use a display name like &ldquo;Rahul S.&rdquo; rather than a full legal name — these are
          photographs of someone&apos;s body on a public website.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          No stories yet. Upload before/after images to the{" "}
          <code className="text-bone">transformations</code> storage bucket, then add a row
          referencing their object keys.
        </EmptyState>
      ) : (
        <TableShell
          head={["Shown as", "Real name", "Goal", "Weeks", "Change", "Consent", "State", ""]}
          minWidth="64rem"
        >
          {rows.map((row) => {
            const isLive = row.is_published && row.consent_on_file;
            const change = Number(row.end_weight_kg ?? 0) - Number(row.start_weight_kg ?? 0);
            return (
              <Row key={row.id}>
                <Cell>{row.display_name || row.client_name}</Cell>
                <Cell muted>{row.client_name}</Cell>
                <Cell muted>{String(row.goal).replace(/_/g, " ")}</Cell>
                <Cell numeric muted>
                  {row.weeks}
                </Cell>
                <Cell numeric>
                  {change > 0 ? "+" : "−"}
                  {Math.abs(change).toFixed(0)} kg
                </Cell>
                <Cell>
                  <StatusPill value={row.consent_on_file ? "confirmed" : "requested"} />
                </Cell>
                <Cell>
                  <StatusPill value={isLive ? "paid" : "cancelled"} />
                </Cell>
                <Cell>
                  <form action={toggleTransformation}>
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      type="hidden"
                      name="published"
                      value={row.is_published ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      disabled={demo || (!row.consent_on_file && !row.is_published)}
                      title={
                        !row.consent_on_file && !row.is_published
                          ? "Record written consent before publishing"
                          : undefined
                      }
                      className="whitespace-nowrap rounded-pill border border-hairline-hi px-4 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.14em] text-ash transition-colors hover:border-blood hover:text-blood-bright disabled:pointer-events-none disabled:opacity-40"
                    >
                      {row.is_published ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                </Cell>
              </Row>
            );
          })}
        </TableShell>
      )}
    </>
  );
}
