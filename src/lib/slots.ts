/**
 * Slot derivation — pure, so it is unit-testable and identical on both sides.
 *
 * Availability is DECLARATIVE (weekday + window), slots are DERIVED, and only
 * bookings are materialised. That keeps "every Tuesday 7am-11am" as one row
 * instead of hundreds of pre-generated slot rows that must be pruned forever.
 */

export interface AvailabilityWindow {
  weekday: number; // 0 = Monday .. 6 = Sunday
  startTime: string; // "07:00"
  endTime: string; // "11:00"
}

export interface TimeOff {
  fromDate: string; // ISO date
  toDate: string;
}

export interface Slot {
  start: string; // "07:30"
  end: string;
  available: boolean;
  reason?: "taken" | "too_soon" | "leave";
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** JS Date.getDay() (0 = Sunday) -> our Monday-first weekday. */
export function weekdayFromISODate(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export interface BuildSlotGridArgs {
  date: string; // ISO date, interpreted in the coach's timezone
  slotMinutes: number;
  leadTimeMinutes: number;
  availability: AvailabilityWindow[];
  timeOff: TimeOff[];
  /** "HH:MM" values already booked for this coach on this date. */
  taken: string[];
  /** Current time, injected so this stays pure and testable. */
  now: Date;
  timezone?: string;
}

export function buildSlotGrid(args: BuildSlotGridArgs): Slot[] {
  const {
    date,
    slotMinutes,
    leadTimeMinutes,
    availability,
    timeOff,
    taken,
    now,
    timezone = "Asia/Kolkata",
  } = args;

  const onLeave = timeOff.some((t) => date >= t.fromDate && date <= t.toDate);
  const weekday = weekdayFromISODate(date);
  const windows = availability.filter((a) => a.weekday === weekday);
  if (windows.length === 0) return [];

  const takenSet = new Set(taken.map((t) => t.slice(0, 5)));
  const slots: Slot[] = [];

  for (const window of windows) {
    const from = toMinutes(window.startTime);
    const to = toMinutes(window.endTime);

    for (let m = from; m + slotMinutes <= to; m += slotMinutes) {
      const start = toHHMM(m);
      const end = toHHMM(m + slotMinutes);

      // Compare against the coach's wall clock, not the server's.
      const slotAt = zonedDateTimeToUtc(date, start, timezone);
      const tooSoon = slotAt.getTime() < now.getTime() + leadTimeMinutes * 60_000;

      let available = true;
      let reason: Slot["reason"];

      if (onLeave) {
        available = false;
        reason = "leave";
      } else if (takenSet.has(start)) {
        available = false;
        reason = "taken";
      } else if (tooSoon) {
        available = false;
        reason = "too_soon";
      }

      slots.push({ start, end, available, reason });
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Interprets "date + time" in a named timezone and returns the UTC instant.
 *
 * Uses Intl to read the zone's offset at that moment rather than assuming a
 * fixed +05:30, so this stays correct for any coach timezone.
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(naive);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  const asZone = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );

  const offset = asZone - naive.getTime();
  return new Date(naive.getTime() - offset);
}

/** Next N dates from today, as ISO strings. */
export function upcomingDates(count: number, from: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
