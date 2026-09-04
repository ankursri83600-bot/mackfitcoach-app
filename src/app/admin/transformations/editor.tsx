"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { deleteTransformation, saveTransformation, type CrudResult } from "./crud";

export interface StoryRow {
  id: string;
  slug: string;
  client_name: string;
  display_name: string | null;
  goal: string;
  weeks: number;
  start_weight_kg: number | null;
  end_weight_kg: number | null;
  before_path?: string | null;
  after_path?: string | null;
  testimonial?: string | null;
  sort_order?: number;
  is_published: boolean;
  consent_on_file: boolean;
}

const IDLE: CrudResult = { ok: false };

const input =
  "w-full rounded-sm border border-hairline-hi bg-surface px-3 py-2 text-caption text-ink outline-none transition-colors placeholder:text-muted-dim focus:border-blood";
const label = "block text-[0.66rem] uppercase tracking-[0.14em] text-muted";

export function NewStoryButton() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-pill grad-blood px-5 py-2.5 font-display text-[0.72rem] uppercase tracking-[0.16em] text-white shadow-accent transition-shadow hover:shadow-e3"
      >
        <Plus className="size-4" aria-hidden="true" />
        New story
      </button>
    );
  }

  return (
    <div className="w-full rounded-md bg-surface p-5 shadow-e2">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-ink">
          New transformation
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel">
          <X className="size-4 text-muted hover:text-ink" />
        </button>
      </div>
      <StoryForm onDone={() => setOpen(false)} />
    </div>
  );
}

export function StoryForm({ story, onDone }: { story?: StoryRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: CrudResult, fd: FormData) => {
      const res = await saveTransformation(prev, fd);
      if (res.ok) onDone?.();
      return res;
    },
    IDLE,
  );

  const k = story?.id ?? "new";

  return (
    <form action={action} className="grid gap-4">
      {story ? <input type="hidden" name="id" value={story.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`client-${k}`}>
            Client name (private)
          </label>
          <input
            id={`client-${k}`}
            name="clientName"
            defaultValue={story?.client_name}
            required
            className={cn(input, "mt-1.5")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`display-${k}`}>
            Shown publicly as
          </label>
          <input
            id={`display-${k}`}
            name="displayName"
            defaultValue={story?.display_name ?? ""}
            placeholder="Rahul S."
            className={cn(input, "mt-1.5")}
          />
          <p className="mt-1 text-[0.62rem] text-muted-dim">
            Use an initial, not a full legal name.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className={label} htmlFor={`slug-${k}`}>
            Slug
          </label>
          <input
            id={`slug-${k}`}
            name="slug"
            defaultValue={story?.slug}
            required
            className={cn(input, "mt-1.5 font-mono")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`goal-${k}`}>
            Goal
          </label>
          <select
            id={`goal-${k}`}
            name="goal"
            defaultValue={story?.goal ?? "fat_loss"}
            className={cn(input, "mt-1.5")}
          >
            <option value="fat_loss">Fat loss</option>
            <option value="muscle_gain">Muscle gain</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`weeks-${k}`}>
            Weeks
          </label>
          <input
            id={`weeks-${k}`}
            name="weeks"
            type="number"
            min={1}
            defaultValue={story?.weeks ?? 12}
            required
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`sort-${k}`}>
            Sort order
          </label>
          <input
            id={`sort-${k}`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={story?.sort_order ?? 0}
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`start-${k}`}>
            Start weight (kg)
          </label>
          <input
            id={`start-${k}`}
            name="startWeightKg"
            type="number"
            step="0.1"
            defaultValue={story?.start_weight_kg ?? ""}
            required
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`end-${k}`}>
            End weight (kg)
          </label>
          <input
            id={`end-${k}`}
            name="endWeightKg"
            type="number"
            step="0.1"
            defaultValue={story?.end_weight_kg ?? ""}
            required
            className={cn(input, "mt-1.5 tabular-nums")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`before-${k}`}>
            Before image (object key)
          </label>
          <input
            id={`before-${k}`}
            name="beforePath"
            defaultValue={story?.before_path ?? ""}
            required
            placeholder="rahul-before.jpg"
            className={cn(input, "mt-1.5 font-mono")}
          />
        </div>
        <div>
          <label className={label} htmlFor={`after-${k}`}>
            After image (object key)
          </label>
          <input
            id={`after-${k}`}
            name="afterPath"
            defaultValue={story?.after_path ?? ""}
            required
            placeholder="rahul-after.jpg"
            className={cn(input, "mt-1.5 font-mono")}
          />
        </div>
      </div>
      <p className="-mt-2 text-[0.62rem] text-muted-dim">
        Keys inside the <code>transformations</code> storage bucket. Upload the files there first.
      </p>

      <div>
        <label className={label} htmlFor={`testi-${k}`}>
          Testimonial
        </label>
        <textarea
          id={`testi-${k}`}
          name="testimonial"
          defaultValue={story?.testimonial ?? ""}
          rows={3}
          className={cn(input, "mt-1.5 resize-y")}
        />
      </div>

      {/* The consent checkbox states what is being attested. A bare "consent"
          label invites a reflexive tick; this one does not. */}
      <div className="rounded-sm bg-warn/8 p-4 ring-1 ring-inset ring-warn/25">
        <label className="flex items-start gap-3 text-caption text-ink">
          <input
            type="checkbox"
            name="consentOnFile"
            defaultChecked={story?.consent_on_file ?? false}
            className="mt-0.5 size-4 shrink-0 accent-blood"
          />
          <span>
            <strong>Written consent is on file</strong> for publishing this person&apos;s
            before/after photographs and results on a public website, and they can withdraw it at
            any time.
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3 border-t border-warn/20 pt-3 text-caption text-ink">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={story?.is_published ?? false}
            className="mt-0.5 size-4 shrink-0 accent-blood"
          />
          <span>Publish — show on the public transformations gallery and home page.</span>
        </label>
      </div>

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
          {pending ? "Saving…" : story ? "Save changes" : "Create story"}
        </button>
        {onDone ? (
          <button type="button" onClick={onDone} className="text-caption text-muted hover:text-ink">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function StoryRowActions({ story }: { story: StoryRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteTransformation, IDLE);

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-pill border border-hairline-hi px-4 py-1.5 text-caption text-ink transition-colors hover:border-blood hover:text-blood"
        >
          {editing ? "Close" : "Edit"}
        </button>

        {confirming ? (
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="id" value={story.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-blood px-4 py-1.5 text-caption text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Confirm"}
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
            aria-label={`Delete ${story.display_name ?? story.client_name}`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-hi px-4 py-1.5 text-caption text-muted transition-colors hover:border-blood hover:text-blood"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>

      {state.error ? (
        <p role="alert" className="mt-2 text-right text-caption text-blood">
          {state.error}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4 rounded-md bg-surface-2 p-5 text-left">
          <StoryForm story={story} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </>
  );
}
