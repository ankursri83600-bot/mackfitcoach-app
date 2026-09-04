import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DemoBanner,
  DetailGrid,
  PageHeading,
  SectionCard,
  StatusPill,
} from "@/components/admin/ui";
import { getIntake, isDemoMode } from "@/lib/admin/queries";
import { ACTIVITY_LABEL, GOAL_LABEL, WEEKDAY_LABEL } from "@/lib/diet/constants";
import { formatDateIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — intake detail" };

export default async function AdminIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = isDemoMode();
  const { row } = await getIntake(id);
  if (!row) notFound();

  const planId = (row as { plan_id?: string | null }).plan_id ?? null;

  return (
    <>
      <PageHeading
        title={(row.full_name ?? "GUEST INTAKE").toUpperCase()}
        subtitle={`Submitted ${formatDateIST(row.created_at)}`}
        action={
          <Link
            href="/admin/diet-requests"
            className="font-display text-[0.7rem] uppercase tracking-[0.14em] text-ash hover:text-bone"
          >
            ← All intakes
          </Link>
        }
      />

      {demo ? <DemoBanner /> : null}

      <div className="grid gap-6">
        {/* The medical note is the single most consequential field on this page,
            so it leads rather than sitting in a grid cell. */}
        {row.medical_notes ? (
          <div className="rounded-md border border-warn/50 bg-warn/10 p-5">
            <p className="font-display text-[0.72rem] uppercase tracking-[0.16em] text-warn">
              Medical note from the client
            </p>
            <p className="mt-3 text-caption leading-relaxed text-bone">{row.medical_notes}</p>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-ash">
              Automated charts are general guidance, not treatment. Review this before the client
              starts, and advise them to speak to their doctor.
            </p>
          </div>
        ) : null}

        <SectionCard title="Contact">
          <DetailGrid
            items={[
              { label: "Name", value: row.full_name ?? "Not given (guest)" },
              {
                label: "Email",
                value: row.email ? (
                  <a href={`mailto:${row.email}`} className="hover:underline">
                    {row.email}
                  </a>
                ) : (
                  "—"
                ),
              },
              {
                label: "Phone",
                value: row.phone ? (
                  <a href={`tel:${row.phone}`} className="hover:underline">
                    {row.phone}
                  </a>
                ) : (
                  "—"
                ),
              },
              { label: "Status", value: <StatusPill value={row.status} /> },
            ]}
          />
        </SectionCard>

        <SectionCard title="Body and goal">
          <DetailGrid
            items={[
              { label: "Age", value: `${row.age} years` },
              { label: "Sex", value: row.gender === "male" ? "Male" : "Female" },
              { label: "Height", value: `${row.height_cm} cm` },
              { label: "Weight", value: `${row.weight_kg} kg` },
              {
                label: "BMI",
                value: (
                  <>
                    {row.bmi}{" "}
                    <span className="text-ash">({String(row.bmi_category).replace("_", " ")})</span>
                  </>
                ),
              },
              { label: "Goal", value: GOAL_LABEL[row.goal as keyof typeof GOAL_LABEL] ?? row.goal },
              {
                label: "Activity",
                value:
                  ACTIVITY_LABEL[row.activity as keyof typeof ACTIVITY_LABEL] ?? row.activity,
              },
              { label: "Meals per day", value: String(row.meals_per_day) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Computed targets">
          <DetailGrid
            items={[
              { label: "BMR", value: `${row.bmr_kcal} kcal` },
              { label: "TDEE", value: `${row.tdee_kcal} kcal` },
              { label: "Daily target", value: `${row.target_kcal} kcal` },
              { label: "Protein", value: `${row.protein_g} g` },
              { label: "Carbs", value: `${row.carbs_g} g` },
              { label: "Fat", value: `${row.fat_g} g` },
            ]}
          />
          <p className="mt-5 text-[0.7rem] leading-relaxed text-ash-dim">
            Stored at generation time, not recomputed on read — so the chart the client received can
            always be audited against the numbers it was built from.
          </p>
        </SectionCard>

        <SectionCard title="Food rules">
          <DetailGrid
            items={[
              { label: "Diet type", value: String(row.diet_type).replace("_", "-") },
              {
                label: "Meat days",
                value:
                  row.nonveg_days?.length
                    ? row.nonveg_days.map((d: number) => WEEKDAY_LABEL[d]).join(", ")
                    : "None",
              },
              {
                label: "Allergens excluded",
                value: row.exclude_tags?.length ? row.exclude_tags.join(", ") : "None",
              },
            ]}
          />
        </SectionCard>

        {planId ? (
          <SectionCard title="Generated chart">
            <Link
              href={`/diet/${planId}`}
              className="inline-flex items-center gap-2 rounded-pill bg-blood px-6 py-3 font-display text-[0.72rem] uppercase tracking-[0.16em] text-bone transition-colors hover:bg-blood-bright"
            >
              Open the client&apos;s chart
            </Link>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
