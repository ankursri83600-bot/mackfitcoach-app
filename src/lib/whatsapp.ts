import { siteConfig } from "@/lib/site-config";
import { formatDateIST, formatTime24to12 } from "@/lib/utils";

/**
 * Builds a wa.me deep link.
 *
 * Always constructed SERVER-side, and only for a booking the caller owns: the
 * coach's number lives in the staff-only `coach_contacts` table and must never
 * be shipped to the browser as data, only baked into a link.
 */
export function whatsappLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export interface BookingMessageArgs {
  bookingId: string;
  coachName: string;
  coachKind: string;
  clientName: string;
  slotDate: string;
  slotStart: string;
  topic?: string | null;
  preferredTime?: string | null;
}

export function bookingWhatsappMessage(args: BookingMessageArgs): string {
  const lines = [
    `Hi ${args.coachName}, I've booked a ${args.coachKind} session through ${siteConfig.name}.`,
    ``,
    `Name: ${args.clientName}`,
    `Date: ${formatDateIST(args.slotDate)}`,
    `Slot: ${formatTime24to12(args.slotStart.slice(0, 5))} IST`,
  ];

  if (args.preferredTime) lines.push(`Preferred time: ${args.preferredTime}`);
  if (args.topic) lines.push(`What I'd like to cover: ${args.topic}`);

  lines.push(``, `Booking ref: ${args.bookingId.slice(0, 8)}`);
  return lines.join("\n");
}

/** Generic business WhatsApp link, for pre-sales questions. */
export function supportWhatsappLink(message = "Hi, I have a question about your coaching plans.") {
  return whatsappLink(siteConfig.contact.whatsapp, message);
}
