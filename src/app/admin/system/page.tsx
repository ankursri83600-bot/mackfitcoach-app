import type { Metadata } from "next";

import { DemoBanner, PageHeading, SectionCard } from "@/components/admin/ui";
import { getSystemStatus, isDemoMode } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — system" };

function StatusRow({
  label,
  ok,
  detail,
  fix,
}: {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-hairline/60 py-4 last:border-0">
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", ok ? "bg-good" : "bg-warn")}
      />
      <div className="min-w-48 flex-1">
        <p className="text-caption text-bone">{label}</p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-ash">{detail}</p>
        {!ok && fix ? (
          <p className="mt-2 text-[0.7rem] leading-relaxed text-warn">{fix}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "rounded-pill border px-3 py-1 font-display text-[0.6rem] uppercase tracking-[0.14em]",
          ok ? "border-good/50 bg-good/10 text-good" : "border-warn/50 bg-warn/10 text-warn",
        )}
      >
        {ok ? "connected" : "not set"}
      </span>
    </div>
  );
}

export default async function AdminSystemPage() {
  const demo = isDemoMode();
  const status = getSystemStatus();

  return (
    <>
      <PageHeading
        title="SYSTEM"
        subtitle="What is wired up, what is still waiting on keys."
      />

      {demo ? <DemoBanner /> : null}

      <div className="grid gap-6">
        <SectionCard title="Integrations">
          <StatusRow
            label="Supabase — database and accounts"
            ok={status.supabase}
            detail="Stores intakes, charts, orders, bookings and the gallery. Also provides sign-in."
            fix="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then apply the five files in supabase/migrations in order."
          />
          <StatusRow
            label="Supabase service role"
            ok={status.serviceRole}
            detail="Server-side key used for privileged writes such as recording a payment. Never exposed to the browser."
            fix="Add SUPABASE_SERVICE_ROLE_KEY. Keep it server-only — never prefix it with NEXT_PUBLIC_."
          />
          <StatusRow
            label={`Razorpay — payments${status.razorpayDetail.mode ? ` (${status.razorpayDetail.mode} mode)` : ""}`}
            ok={status.razorpay}
            detail="Takes UPI, cards, net banking and wallets in rupees."
            fix={
              status.razorpayDetail.missing.filter((v) => v !== "RAZORPAY_WEBHOOK_SECRET").length
                ? `Still needed in .env.local: ${status.razorpayDetail.missing
                    .filter((v) => v !== "RAZORPAY_WEBHOOK_SECRET")
                    .join(", ")}.`
                : status.razorpayDetail.invalid.length
                  ? `Wrong shape: ${status.razorpayDetail.invalid.join(", ")}.`
                  : undefined
            }
          />
          <StatusRow
            label="Razorpay webhook"
            ok={status.webhook}
            detail="The authority on whether a payment succeeded. Without it, a customer who closes the tab mid-payment may never get access."
            fix="Create a webhook in the Razorpay dashboard pointing at /api/razorpay/webhook for payment.captured, payment.failed and refund.processed, then add RAZORPAY_WEBHOOK_SECRET."
          />
        </SectionCard>

        <SectionCard title="What still works without any of this">
          <ul className="space-y-3 text-caption leading-relaxed text-ash">
            <li>
              <span className="text-bone">The whole public site</span> — every page renders, nothing
              errors.
            </li>
            <li>
              <span className="text-bone">The diet chart engine</span> — BMI, BMR, targets and the
              full 7-day plan are computed locally with no database and no external service.
            </li>
            <li>
              <span className="text-bone">PDF download and print</span> — generated on the server
              from the same plan.
            </li>
            <li>
              <span className="text-bone">This admin console</span> — shown with sample rows so the
              screens can be reviewed before going live.
            </li>
          </ul>
          <p className="mt-5 text-[0.7rem] leading-relaxed text-ash-dim">
            Charts generated without Supabase are held in memory only, so they disappear when the
            server restarts. Connecting Supabase makes them permanent.
          </p>
        </SectionCard>

        <SectionCard title="Environment">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-ash-dim">Mode</dt>
              <dd className="mt-1 font-mono text-caption text-bone">{status.nodeEnv}</dd>
            </div>
            <div>
              <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-ash-dim">Site URL</dt>
              <dd className="mt-1 font-mono text-caption text-bone">
                {status.siteUrl ?? "not set — used for auth redirects and share links"}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Checks you can run">
          <div className="grid gap-3">
            {[
              ["npm run test", "49 tests over the diet engine — determinism, allergens, calorie safety floors."],
              ["npm run test:db", "Applies all five migrations to a real Postgres and probes payment idempotency, mismatch refusal and the double-booking guard."],
              ["npm run test:all", "Both of the above."],
              ["npm run seed:coaches", "Creates the three starter coaches with weekly availability."],
            ].map(([cmd, what]) => (
              <div key={cmd} className="rounded-sm border border-hairline-hi bg-ink px-4 py-3">
                <code className="font-mono text-[0.72rem] text-blood-bright">{cmd}</code>
                <p className="mt-1.5 text-[0.7rem] leading-relaxed text-ash">{what}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
