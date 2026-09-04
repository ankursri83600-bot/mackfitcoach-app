/**
 * Single source of truth for brand identity and contact details.
 * Renaming the business or changing a phone number is a one-file edit.
 */
export const siteConfig = {
  name: "MackFitCoach",
  /** Rendered as two-tone in the wordmark: bone + blood. */
  nameParts: { lead: "MACK", accent: "FIT", sub: "COACH" },
  tagline: "Real coaching. Real transformations.",
  description:
    "Personalised Indian diet charts, body transformation coaching, and 1-to-1 sessions with a certified dietician and trainer.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  contact: {
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "coach@mackfitcoach.com",
    /** E.164, digits only after the +. Used to build wa.me links. */
    whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+919999999999",
    phoneLabel: "+91 99999 99999",
    city: "India",
  },

  social: {
    instagram: "https://instagram.com/mackfitcoach",
    youtube: "https://youtube.com/@mackfitcoach",
  },

  /** Marketing counters. Kept here so they are not hardcoded in a component. */
  stats: [
    { value: 1200, suffix: "+", label: "Clients coached" },
    { value: 8400, suffix: "kg", label: "Total fat lost" },
    { value: 12, suffix: "yrs", label: "Coaching experience" },
    { value: 96, suffix: "%", label: "Stick to their plan" },
  ],

  timezone: "Asia/Kolkata",
} as const;

export type SiteConfig = typeof siteConfig;

/** Build a wa.me deep link. Never pass a number the user did not earn access to. */
export function whatsappLink(phoneE164: string, message: string) {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
