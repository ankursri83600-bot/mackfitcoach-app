import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * All money in this app is integer paise, never rupees and never floats.
 * Razorpay's API is paise-native, and `149.99 * 100` is 14998.999... — which
 * would produce an off-by-one-paise mismatch that the payment RPC correctly
 * refuses, turning a rounding bug into a failed sale.
 */
export function formatINR(paise: number, opts?: { withDecimals?: boolean }) {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: opts?.withDecimals ? 2 : 0,
    maximumFractionDigits: opts?.withDecimals ? 2 : 0,
  }).format(rupees);
}

/** Always pass an explicit timeZone — server, DB, coach and browser all differ. */
export function formatDateIST(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/** "14:30" -> "2:30 PM" without constructing a Date (no timezone ambiguity). */
export function formatTime24to12(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mRaw ?? "00"} ${suffix}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
