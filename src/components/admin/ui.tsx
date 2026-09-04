import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Admin console primitives.
 *
 * This is a tool, not a document, so the craft here is information design:
 * state is encoded in form as well as text (a coloured stripe, a pill), the
 * summary comes before the detail, and digits line up in columns.
 */

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-h3 leading-none text-bone">{title}</h1>
        {subtitle ? <p className="mt-2 text-caption text-ash">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-8 rounded-md border border-warn/40 bg-warn/10 px-5 py-4">
      <p className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-warn">
        Sample data
      </p>
      <p className="mt-2 text-caption leading-relaxed text-ash">
        {children ?? (
          <>
            Supabase is not connected, so these rows are illustrative samples — not real customers.
            Add your keys to <code className="text-bone">.env.local</code> and every screen switches
            to live data. Sign-in is also enforced from that point on.
          </>
        )}
      </p>
    </div>
  );
}

/** Big number tile. `tone` encodes whether the value needs attention. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const stripe = {
    neutral: "bg-hairline-hi",
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-blood",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-md border border-hairline bg-surface p-5">
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", stripe)} />
      <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ash">{label}</p>
      <p className="mt-2 font-display text-h3 leading-none tabular-nums text-bone">{value}</p>
      {hint ? <p className="mt-2 text-[0.7rem] text-ash-dim">{hint}</p> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  // Money
  paid: "border-good/50 bg-good/10 text-good",
  created: "border-hairline-hi bg-surface-2 text-ash",
  attempted: "border-warn/50 bg-warn/10 text-warn",
  failed: "border-blood/60 bg-blood/10 text-blood-bright",
  mismatch: "border-blood/60 bg-blood/15 text-blood-bright",
  refunded: "border-warn/50 bg-warn/10 text-warn",
  cancelled: "border-hairline-hi bg-surface-2 text-ash-dim",
  // Bookings
  requested: "border-warn/50 bg-warn/10 text-warn",
  confirmed: "border-good/50 bg-good/10 text-good",
  completed: "border-good/40 bg-good/5 text-good",
  // Intakes
  submitted: "border-warn/50 bg-warn/10 text-warn",
  plan_generated: "border-good/50 bg-good/10 text-good",
  archived: "border-hairline-hi bg-surface-2 text-ash-dim",
  // Roles
  admin: "border-blood/60 bg-blood/10 text-blood-bright",
  dietician: "border-good/50 bg-good/10 text-good",
  trainer: "border-good/40 bg-good/5 text-good",
  user: "border-hairline-hi bg-surface-2 text-ash",
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-pill border px-2.5 py-1 font-display text-[0.6rem] uppercase tracking-[0.14em]",
        STATUS_TONES[value] ?? "border-hairline-hi bg-surface-2 text-ash",
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

/** Horizontally scrollable table shell — the page body must never scroll sideways. */
export function TableShell({
  head,
  children,
  minWidth = "60rem",
}: {
  head: string[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-hairline" data-lenis-prevent>
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-hairline bg-surface">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-4 py-3 font-display text-[0.62rem] uppercase tracking-[0.16em] text-ash"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-hairline/50 align-middle last:border-0 hover:bg-surface/60">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  numeric,
  muted,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-caption",
        numeric && "font-mono tabular-nums",
        muted ? "text-ash" : "text-bone",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-hairline-hi bg-surface/50 px-6 py-12 text-center">
      <p className="text-caption text-ash">{children}</p>
    </div>
  );
}

/** Definition list used on the detail screens. */
export function DetailGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-ash-dim">{item.label}</dt>
          <dd className="mt-1 text-caption text-bone">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-hairline bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
        <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-bone">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
