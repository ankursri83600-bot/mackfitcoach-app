import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/motion/reveal";
import { Badge, ButtonLink, Card, Container, Eyebrow, Rule, Section } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { bookingWhatsappMessage, whatsappLink } from "@/lib/whatsapp";
import { formatDateIST, formatTime24to12 } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking confirmed" };

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, user_id, email, name, phone, slot_date, slot_start, status, topic, preferred_time, mode, coach_id, coaches(name, kind, slug)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) notFound();

  // Access: the owner, or an anonymous booker who has the (unguessable) id.
  // A signed-in user must not be able to read someone else's booking.
  const user = await getCurrentUser();
  if (booking.user_id && (!user || user.id !== booking.user_id)) {
    const { data: profile } = user
      ? await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    const isStaff =
      profile && ["admin", "dietician", "trainer"].includes(profile.role as string);
    if (!isStaff) notFound();
  }

  const coach = booking.coaches as { name?: string; kind?: string } | null;

  // The coach's number is read here, server-side, and only ever leaves as part of
  // a link — it is never sent to the browser as data.
  const { data: contact } = await admin
    .from("coach_contacts")
    .select("phone_e164")
    .eq("coach_id", booking.coach_id as string)
    .maybeSingle();

  const coachPhone = contact?.phone_e164 as string | undefined;

  const waHref = coachPhone
    ? whatsappLink(
        coachPhone,
        bookingWhatsappMessage({
          bookingId: booking.id as string,
          coachName: coach?.name ?? "Coach",
          coachKind: coach?.kind ?? "coaching",
          clientName: booking.name as string,
          slotDate: booking.slot_date as string,
          slotStart: String(booking.slot_start),
          topic: booking.topic as string | null,
          preferredTime: booking.preferred_time as string | null,
        }),
      )
    : null;

  return (
    <Section className="min-h-[60vh]">
      <Container className="max-w-xl">
        <Reveal>
          <CalendarCheck className="size-10 text-good" aria-hidden="true" />
          <Eyebrow className="mt-6">Booking {booking.status as string}</Eyebrow>
          <h1 className="mt-3 font-display text-h2 text-bone">YOUR SESSION</h1>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="mt-8">
            <dl className="space-y-3 text-caption">
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Coach</dt>
                <dd className="text-bone">
                  {coach?.name} <span className="text-ash">({coach?.kind})</span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Date</dt>
                <dd className="text-bone">{formatDateIST(booking.slot_date as string)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Time</dt>
                <dd className="font-mono tabular-nums text-bone">
                  {formatTime24to12(String(booking.slot_start).slice(0, 5))} IST
                </dd>
              </div>
              {booking.preferred_time ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ash">Preferred time</dt>
                  <dd className="text-bone">{booking.preferred_time as string}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Status</dt>
                <dd>
                  <Badge tone={booking.status === "confirmed" ? "good" : "neutral"}>
                    {booking.status as string}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Reference</dt>
                <dd className="font-mono text-bone">
                  {(booking.id as string).slice(0, 8).toUpperCase()}
                </dd>
              </div>
            </dl>

            <Rule className="my-6" />

            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-bone">
              Talk to your coach
            </h2>
            <p className="mt-2 text-caption text-ash">
              Message now to introduce yourself — your coach will confirm the slot and take it from
              there.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-pill bg-good px-7 py-3.5 font-display text-[0.82rem] uppercase tracking-[0.16em] text-ink transition-opacity hover:opacity-90"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Open WhatsApp
                </a>
              ) : (
                <p className="text-caption text-warn">
                  Your coach&apos;s WhatsApp number is not on file yet — we will email you the
                  details.
                </p>
              )}

              {coachPhone ? (
                <a
                  href={`tel:${coachPhone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-pill border border-hairline-hi px-7 py-3.5 font-display text-[0.82rem] uppercase tracking-[0.16em] text-bone transition-colors hover:border-blood"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  Call
                </a>
              ) : null}
            </div>

            <Rule className="my-6" />
            <ButtonLink href="/dashboard" variant="outline">
              Back to dashboard
            </ButtonLink>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
