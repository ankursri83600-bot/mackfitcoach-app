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
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-8">
        {/* Coach */}
        <fieldset>
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-bone">
            1. Choose a coach
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {coaches.map((coach) => (
              <button
                key={coach.slug}
                type="button"
                aria-pressed={coachSlug === coach.slug}
                onClick={() => setCoachSlug(coach.slug)}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                  coachSlug === coach.slug
                    ? "border-blood bg-blood/10"
                    : "border-hairline-hi hover:border-bone/40",
                )}
              >
                <Image
                  src={coach.photoSrc}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 shrink-0 rounded-full object-cover"
                />
                <span>
                  <span className="block text-caption text-bone">{coach.name}</span>
                  <span className="block text-[0.7rem] text-ash">{coach.kind}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Date */}
        <fieldset>
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-bone">
            2. Pick a date
          </legend>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2" data-lenis-prevent>
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => setDate(d)}
                className={cn(
                  "shrink-0 rounded-md border px-4 py-3 text-center transition-colors",
                  date === d ? "border-blood bg-blood/10" : "border-hairline-hi hover:border-bone/40",
                )}
              >
                <span className="block font-mono text-caption tabular-nums text-bone">
                  {d.slice(8, 10)}
                </span>
                <span className="block text-[0.65rem] uppercase text-ash">
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
          <legend className="font-display text-sm uppercase tracking-[0.14em] text-bone">
            3. Pick a time
          </legend>
          <div className="mt-4">
            {loadingSlots ? (
              <p className="text-caption text-ash">Loading slots…</p>
            ) : slotsMessage ? (
              <FormAlert tone="info">{slotsMessage}</FormAlert>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                      "rounded-sm border px-2 py-2 font-mono text-[0.75rem] tabular-nums transition-colors",
                      slotStart === slot.start
                        ? "border-blood bg-blood text-bone"
                        : slot.available
                          ? "border-hairline-hi text-bone hover:border-blood"
                          : "border-hairline text-ash-dim line-through opacity-50",
                    )}
                  >
                    {formatTime24to12(slot.start)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </fieldset>
      </div>

      {/* Details */}
      <Card className="h-fit">
        <h2 className="font-display text-sm uppercase tracking-[0.14em] text-bone">
          4. Your details
        </h2>

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

          <div className="rounded-sm border border-hairline bg-surface-2 px-4 py-3 text-caption text-ash">
            {slotStart ? (
              <>
                Booking <strong className="text-bone">{formatDateIST(date)}</strong> at{" "}
                <strong className="text-bone">{formatTime24to12(slotStart)} IST</strong>
              </>
            ) : (
              "Select a date and time to continue."
            )}
          </div>

          <Button type="submit" disabled={busy || !slotStart || !bookingEnabled}>
            {busy ? "Booking…" : "Request this slot"}
          </Button>

          <p className="text-[0.7rem] leading-relaxed text-ash-dim">
            You will get a WhatsApp link to your coach as soon as the booking is in. Sessions are
            confirmed by the coach, usually within a few hours.
          </p>
        </div>
      </Card>
    </form>
  );
}
