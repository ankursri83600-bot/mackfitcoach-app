"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { WEEKDAY_LABEL } from "@/lib/diet/constants";
import { formatTime24to12 } from "@/lib/utils";
import { cn } from "@/lib/utils";

import {
  addAvailability,
  deleteAvailability,
  deleteCoach,
  saveCoach,
  setCoachActive,
  type ActionResult,
} from "./actions";

export interface CoachRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  slot_minutes: number;
  lead_time_minutes: number;
  max_days_ahead: number;
  sort_order: number;
  is_active: boolean;
  phone: string | null;
  windows: { id?: string; weekday: number; start_time: string; end_time: string }[];
}

const IDLE: ActionResult = { ok: false };

const input =
  "w-full rounded-sm border border-hairline-hi bg-surface px-3 py-2 text-caption text-ink outline-none transition-colors placeholder:text-muted-dim focus:border-blood";
const label = "block text-[0.66rem] uppercase tracking-[0.14em] text-muted";

/* ------------------------------------------------------------- new coach -- */

export function NewCoachButton() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-pill grad-blood px-5 py-2.5 font-display text-[0.72rem] uppercase tracking-[0.16em] text-white shadow-accent transition-shadow hover:shadow-e3"
      >
        <Plus className="size-4" aria-hidden="true" />
        New coach
      </button>
    );
  }

  return (
    <div className="w-full rounded-md bg-surface p-5 shadow-e2">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-ink">
          New coach
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel">
          <X className="size-4 text-muted hover:text-ink" />
        </button>
      </div>
      <CoachForm onDone={() => setOpen(false)} />
    </div>
  );
}

/* ----------------------------------------------------------------- form -- */

export function CoachForm({ coach, onDone }: { coach?: CoachRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const res = await saveCoach(prev, fd);
      if (res.ok) onDone?.();
      return res;
    },
    IDLE,
  );

  return (
    <form action={action} className="grid gap-4">
      {coach ? <input type="hidden" name="id" value={coach.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`name-${coach?.id ?? "new"}`}>
            Name
          </label>
          <input
            id={`name-${coach?.id ?? "new"}`}
            name="name"
            defaultValue={coach?.name}
            required
            className={cn(input, "mt-1.5")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`slug-${coach?.id ?? "new"}`}>
            URL slug
          </label>
          <input
            id={`slug-${coach?.id ?? "new"}`}
            name="slug"
            defaultValue={coach?.slug}
            required
            placeholder="coach-mack"
            className={cn(input, "mt-1.5 font-mono")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`kind-${coach?.id ?? "new"}`}>
            Role
          </label>
          <select
            id={`kind-${coach?.id ?? "new"}`}
            name="kind"
            defaultValue={coach?.kind ?? "trainer"}
            className={cn(input, "mt-1.5")}
          >
            <option value="trainer">Trainer</option>
            <option value="dietician">Dietician</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`phone-${coach?.id ?? "new"}`}>
            WhatsApp (E.164)
          </label>
          <input
            id={`phone-${coach?.id ?? "new"}`}
            name="phone"
            defaultValue={coach?.phone ?? ""}
            placeholder="+919876543210"
            className={cn(input, "mt-1.5 font-mono")}
          />
          <p className="mt-1 text-[0.62rem] text-muted-dim">
            Stored in <code>coach_contacts</code>, never exposed publicly. Empty removes it.
          </p>
        </div>
      </div>

      <div>
        <label className={label} htmlFor={`headline-${coach?.id ?? "new"}`}>
          Headline
        </label>
        <input
          id={`headline-${coach?.id ?? "new"}`}
          name="headline"
          defaultValue={coach?.headline ?? ""}
          placeholder="Head coach and founder"
          className={cn(input, "mt-1.5")}
        />
      </div>

      <div>
        <label className={label} htmlFor={`bio-${coach?.id ?? "new"}`}>
          Bio
        </label>
        <textarea
          id={`bio-${coach?.id ?? "new"}`}
          name="bio"
          defaultValue={coach?.bio ?? ""}
          rows={3}
          className={cn(input, "mt-1.5 resize-y")}
        />
      </div>

      <div>
        <label className={label} htmlFor={`spec-${coach?.id ?? "new"}`}>
          Specialties (comma separated)
        </label>
        <input
          id={`spec-${coach?.id ?? "new"}`}
          name="specialties"
          defaultValue={coach?.specialties?.join(", ") ?? ""}
          placeholder="Body recomposition, Strength, Contest prep"
          className={cn(input, "mt-1.5")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className={label} htmlFor={`slot-${coach?.id ?? "new"}`}>
            Session (min)
          </label>
          <select
            id={`slot-${coach?.id ?? "new"}`}
            name="slotMinutes"
            defaultValue={String(coach?.slot_minutes ?? 30)}
            className={cn(input, "mt-1.5")}
          >
            {[15, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`lead-${coach?.id ?? "new"}`}>
            Notice (min)
          </label>
          <input
            id={`lead-${coach?.id ?? "new"}`}
            name="leadTimeMinutes"
            type="number"
            min={0}
            defaultValue={coach?.lead_time_minutes ?? 120}
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`ahead-${coach?.id ?? "new"}`}>
            Days ahead
          </label>
          <input
            id={`ahead-${coach?.id ?? "new"}`}
            name="maxDaysAhead"
            type="number"
            min={1}
            defaultValue={coach?.max_days_ahead ?? 30}
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`sort-${coach?.id ?? "new"}`}>
            Sort order
          </label>
          <input
            id={`sort-${coach?.id ?? "new"}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={coach?.sort_order ?? 0}
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2.5 text-caption text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coach?.is_active ?? true}
          className="size-4 accent-blood"
        />
        Active — visible on the site and bookable
      </label>

      {state.error ? (
        <p role="alert" className="rounded-sm bg-blood-tint px-3 py-2 text-caption text-blood-deep">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill grad-blood px-6 py-2.5 font-display text-[0.72rem] uppercase tracking-[0.16em] text-white shadow-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : coach ? "Save changes" : "Create coach"}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="text-caption text-muted hover:text-ink"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

/* --------------------------------------------------------- availability -- */

export function AvailabilityEditor({ coach }: { coach: CoachRow }) {
  const [state, action, pending] = useActionState(addAvailability, IDLE);

  return (
    <div>
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-dim">
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
              key={w.id ?? `${w.weekday}-${w.start_time}-${i}`}
              className="group inline-flex items-center gap-2 rounded-sm border border-hairline-hi px-3 py-1.5 font-mono text-[0.68rem] tabular-nums text-muted"
            >
              <span className="text-ink">{WEEKDAY_LABEL[w.weekday].slice(0, 3)}</span>{" "}
              {formatTime24to12(w.start_time)} – {formatTime24to12(w.end_time)}
              {w.id ? (
                <form action={deleteAvailability} className="contents">
                  <input type="hidden" name="windowId" value={w.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${WEEKDAY_LABEL[w.weekday]} ${w.start_time} window`}
                    className="text-muted-dim transition-colors hover:text-blood"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="coachId" value={coach.id} />
        <div>
          <label className={label} htmlFor={`wd-${coach.id}`}>
            Day
          </label>
          <select id={`wd-${coach.id}`} name="weekday" className={cn(input, "mt-1.5 w-32")}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`st-${coach.id}`}>
            From
          </label>
          <input
            id={`st-${coach.id}`}
            name="startTime"
            type="time"
            defaultValue="09:00"
            required
            className={cn(input, "mt-1.5 w-32 tabular-nums")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`et-${coach.id}`}>
            To
          </label>
          <input
            id={`et-${coach.id}`}
            name="endTime"
            type="time"
            defaultValue="17:00"
            required
            className={cn(input, "mt-1.5 w-32 tabular-nums")}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-hi px-4 py-2 text-caption text-ink transition-colors hover:border-blood hover:text-blood disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {pending ? "Adding…" : "Add window"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-sm bg-blood-tint px-3 py-2 text-caption text-blood-deep">
          {state.error}
        </p>
      ) : null}

      <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-dim">
        Slots are derived from these windows at request time, so a change takes effect immediately
        — there are no pre-generated slot rows to clean up.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- actions -- */

export function CoachRowActions({ coach }: { coach: CoachRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteCoach, IDLE);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-pill border border-hairline-hi px-4 py-1.5 text-caption text-ink transition-colors hover:border-blood hover:text-blood"
        >
          {editing ? "Close" : "Edit"}
        </button>

        <form action={setCoachActive}>
          <input type="hidden" name="id" value={coach.id} />
          <input type="hidden" name="active" value={String(!coach.is_active)} />
          <button
            type="submit"
            className="rounded-pill border border-hairline-hi px-4 py-1.5 text-caption text-ink transition-colors hover:border-blood hover:text-blood"
          >
            {coach.is_active ? "Deactivate" : "Activate"}
          </button>
        </form>

        {confirming ? (
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="id" value={coach.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-blood px-4 py-1.5 text-caption text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-caption text-muted hover:text-ink"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${coach.name}`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-hi px-4 py-1.5 text-caption text-muted transition-colors hover:border-blood hover:text-blood"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-sm bg-blood-tint px-3 py-2 text-caption text-blood-deep">
          {state.error}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-5 rounded-md bg-surface-2 p-5">
          <CoachForm coach={coach} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </>
  );
}
