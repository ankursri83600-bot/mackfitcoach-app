import type { Metadata } from "next";
import Link from "next/link";

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
import { getIntakes, isDemoMode } from "@/lib/admin/queries";
import { WEEKDAY_SHORT } from "@/lib/diet/constants";
import { formatDateIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — intakes" };

export default async function AdminIntakesPage() {
  const demo = isDemoMode();
  const { rows } = await getIntakes(200);

  const flagged = rows.filter((r) => r.medical_notes);
  const vegan = rows.filter((r) => r.diet_type === "vegan").length;
  const nonVeg = rows.filter((r) => r.diet_type === "non_veg").length;

  return (
    <>
      <PageHeading
        title="INTAKES"
        subtitle={`${rows.length} submission${rows.length === 1 ? "" : "s"} · each one generated a chart`}
      />

      {demo ? <DemoBanner /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total intakes" value={String(rows.length)} />
        <StatTile
          label="Medical notes"
          value={String(flagged.length)}
          tone={flagged.length ? "warn" : "good"}
          hint="Review before the first consult"
        />
        <StatTile label="Non-veg" value={String(nonVeg)} hint="Chose specific meat days" />
        <StatTile label="Vegan" value={String(vegan)} hint="No dairy or egg" />
      </section>

      {flagged.length > 0 ? (
        <div className="mt-8 rounded-md border border-warn/40 bg-warn/10 p-5">
          <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-warn">
            {flagged.length} intake{flagged.length === 1 ? "" : "s"} disclosed a medical condition
          </p>
          <p className="mt-2 max-w-2xl text-caption leading-relaxed text-ash">
            An automatically generated chart is general guidance, not treatment. Have the dietician
            read these before the client starts, and tell them to speak to their doctor.
          </p>
        </div>
      ) : null}

      <div className="mt-8">
        {rows.length === 0 ? (
          <EmptyState>No intakes yet. They appear the moment someone builds a chart.</EmptyState>
        ) : (
          <TableShell
            head={["Submitted", "Person", "Body", "Goal", "Diet", "Meat days", "Target", "Status", ""]}
            minWidth="76rem"
          >
            {rows.map((intake) => (
              <Row key={intake.id}>
                <Cell numeric muted>
                  {formatDateIST(intake.created_at)}
                </Cell>
                <Cell>
                  <span className="block">{intake.full_name ?? "Guest"}</span>
                  <span className="block text-[0.68rem] text-ash-dim">
                    {intake.email ?? "no email"}
                  </span>
                  {intake.medical_notes ? (
                    <span className="mt-1 inline-block rounded-pill border border-warn/50 bg-warn/10 px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-warn">
                      medical note
                    </span>
                  ) : null}
                </Cell>
                <Cell numeric muted>
                  {intake.age}y {intake.gender === "male" ? "M" : "F"} · {intake.height_cm}cm ·{" "}
                  {intake.weight_kg}kg
                  <span className="block text-[0.68rem]">BMI {intake.bmi}</span>
                </Cell>
                <Cell muted>{String(intake.goal).replace(/_/g, " ")}</Cell>
                <Cell muted>{String(intake.diet_type).replace("_", "-")}</Cell>
                <Cell numeric muted className="text-[0.7rem]">
                  {intake.nonveg_days?.length
                    ? intake.nonveg_days.map((d: number) => WEEKDAY_SHORT[d]).join(" ")
                    : "—"}
                </Cell>
                <Cell numeric>
                  {intake.target_kcal} kcal
                  <span className="block text-[0.68rem] text-ash-dim">
                    P{intake.protein_g} C{intake.carbs_g} F{intake.fat_g}
                  </span>
                </Cell>
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
      </div>
    </>
  );
}
