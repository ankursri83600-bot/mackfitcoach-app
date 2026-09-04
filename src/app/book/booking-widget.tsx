"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Field, FormAlert, Input, Textarea } from "@/components/form";
import { Button, Card } from "@/components/ui";
import type { Slot } from "@/lib/slots";
import { cn, formatDateIST, formatTime24to12 } from "@/lib/utils";

interface CoachOption {
  slug: string;
  name: string;
  kind: string;
  headline: string;
  photoSrc: string;
}

export function BookingWidget({
  coaches,
  dates,
  bookingEnabled,
}: {
  coaches: CoachOption[];
  dates: string[];
  bookingEnabled: boolean;
}) {
  const router = useRouter();
  const [coachSlug, setCoachSlug] = useState(coaches[0]?.slug ?? "");
  const [date, setDate] = useState(dates[0] ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [topic, setTopic] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSlots = useCallback(async () => {
    if (!coachSlug || !date || !bookingEnabled) return;
    setLoadingSlots(true);
    setSlotStart(null);
    setSlotsMessage(null);

    try {
      const res = await fetch(
        `/api/coaches/${encodeURIComponent(coachSlug)}/slots?date=${encodeURIComponent(date)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      setSlots(data.slots ?? []);
      if (data.message) setSlotsMessage(data.message);
      else if ((data.slots ?? []).length === 0) {
        setSlotsMessage("No slots on this day — try another date.");
      }
    } catch {
      setSlotsMessage("Could not load slots.");
    } finally {
      setLoadingSlots(false);
    }
  }, [coachSlug, date, bookingEnabled]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotStart) {
      setError("Pick a time slot first.");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachSlug,
        slotDate: date,
        slotStart,
        name,
        email,
        phone,
        preferredTime,
        topic,
      }),
    });

    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Could not complete the booking.");
      // 409 means someone else took it between load and submit.
      if (res.status === 409) void loadSlots();
      return;
    }

    router.push(data.redirect);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8"
    >
      <div className="flex min-w-0 flex-col gap-6">
        {/* Coach */}
        <fieldset>
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-ink">
            1. Choose a coach
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {coaches.map((coach) => (
              <button
                key={coach.slug}
                type="button"
                aria-pressed={coachSlug === coach.slug}
                onClick={() => setCoachSlug(coach.slug)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-md p-3 text-left",
                  "transition-[box-shadow,transform,background-color] duration-200 ease-out-quart",
                  "motion-reduce:transform-none",
                  coachSlug === coach.slug
                    ? "grad-blood text-white shadow-accent"
                    : "bg-surface text-ink shadow-e1 hover:-translate-y-0.5 hover:shadow-e2",
                )}
              >
                <Image
                  src={coach.photoSrc}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-caption font-semibold">{coach.name}</span>
                  <span
                    className={cn(
                      "block text-[0.7rem] capitalize",
                      coachSlug === coach.slug ? "text-white/75" : "text-muted",
                    )}
                  >
                    {coach.kind}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Date */}
        <fieldset>
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-ink">
            2. Pick a date
          </legend>
          <div
            className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2
                       [scrollbar-width:thin]"
            data-lenis-prevent
          >
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => setDate(d)}
                className={cn(
                  "min-w-[3.75rem] shrink-0 snap-start rounded-md px-4 py-3 text-center",
                  "transition-[box-shadow,transform,background-color] duration-200 ease-out-quart",
                  "motion-reduce:transform-none",
                  date === d
                    ? "grad-blood text-white shadow-accent"
                    : "bg-surface text-ink shadow-e1 hover:-translate-y-0.5 hover:shadow-e2",
                )}
              >
                <span className="block font-mono text-caption tabular-nums">{d.slice(8, 10)}</span>
                <span
                  className={cn(
                    "block text-[0.65rem] uppercase",
                    date === d ? "text-white/75" : "text-muted",
                  )}
                >
                  {new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Slots */}
        <fieldset>
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-ink">
            3. Pick a time
          </legend>
          <div className="mt-4">
            {loadingSlots ? (
              <p className="text-caption text-muted">Loading slots…</p>
            ) : slotsMessage ? (
              <FormAlert tone="info">{slotsMessage}</FormAlert>
            ) : (
              <>
              {/*
                Every slot present but none bookable is the normal state for
                TODAY once the lead time has passed, and a grid of struck-out
                times with no explanation reads as a broken page. Say why.
              */}
              {slots.length > 0 && slots.every((sl) => !sl.available) ? (
                <p className="mb-3 rounded-sm bg-surface-2 px-3 py-2 text-caption text-muted">
                  Every time on this day is either booked or inside the coach&apos;s minimum
                  notice period. Pick a later date.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4 xl:grid-cols-5">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={slotStart === slot.start}
                    onClick={() => setSlotStart(slot.start)}
                    title={
                      slot.reason === "taken"
                        ? "Already booked"
                        : slot.reason === "too_soon"
                          ? "Too soon to book"
                          : undefined
                    }
                    className={cn(
                      "min-h-11 rounded-sm px-2 py-2 font-mono text-[0.75rem] tabular-nums",
                      "transition-[box-shadow,transform,background-color] duration-200 ease-out-quart",
                      "motion-reduce:transform-none",
                      slotStart === slot.start
                        ? "grad-blood text-white shadow-accent"
                        : slot.available
                          ? "bg-surface text-ink shadow-e1 hover:-translate-y-0.5 hover:shadow-e2"
                          : "bg-surface-2 text-muted-dim line-through",
                    )}
                  >
                    {formatTime24to12(slot.start)}
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {/* Details */}
      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="font-display text-sm uppercase tracking-[0.14em] text-ink">
          4. Your details
        </h2>

        {/*
          Live summary of steps 1-3.

          On a phone the three pickers scroll off the top long before the submit
          button, so a visitor filling in their name could no longer see which
          slot they had chosen. Echoing it here means the choice is visible at
          the moment of committing.
        */}
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-3 text-[0.7rem]">
          <div className="min-w-0">
            <dt className="uppercase tracking-[0.12em] text-muted-dim">Coach</dt>
            <dd className="mt-0.5 truncate font-semibold text-ink">
              {coaches.find((c) => c.slug === coachSlug)?.name ?? "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="uppercase tracking-[0.12em] text-muted-dim">Date</dt>
            <dd className="mt-0.5 truncate font-semibold text-ink tabular-nums">
              {date
                ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })
                : "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="uppercase tracking-[0.12em] text-muted-dim">Time</dt>
            <dd className="mt-0.5 truncate font-semibold text-ink tabular-nums">
              {slotStart ? formatTime24to12(slotStart) : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}

          <Field label="Name" htmlFor="b-name" required>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <Field label="Email" htmlFor="b-email" required>
            <Input
              id="b-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="WhatsApp number" htmlFor="b-phone" hint="The coach will reach you here." required>
            <Input
              id="b-phone"
              type="tel"
              placeholder="+91 99999 99999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Preferred time"
            htmlFor="b-preferred"
            hint="Optional — if the slot above is not ideal, tell us what suits you."
          >
            <Input
              id="b-preferred"
              placeholder="e.g. after 7pm on weekdays"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            />
          </Field>

          <Field label="What would you like to cover?" htmlFor="b-topic">
            <Textarea id="b-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>

          <div className="rounded-sm border border-hairline bg-surface-2 px-4 py-3 text-caption text-muted">
            {slotStart ? (
              <>
                Booking <strong className="text-ink">{formatDateIST(date)}</strong> at{" "}
                <strong className="text-ink">{formatTime24to12(slotStart)} IST</strong>
              </>
            ) : (
              "Select a date and time to continue."
            )}
          </div>

          <Button type="submit" disabled={busy || !slotStart || !bookingEnabled}>
            {busy ? "Booking…" : "Request this slot"}
          </Button>

          <p className="text-[0.7rem] leading-relaxed text-muted-dim">
            You will get a WhatsApp link to your coach as soon as the booking is in. Sessions are
            confirmed by the coach, usually within a few hours.
          </p>
        </div>
      </Card>
    </form>
  );
}
