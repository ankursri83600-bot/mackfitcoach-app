/**
 * Never prerendered.
 *
 * This page's output depends entirely on who is signed in. Without this, a build
 * that runs before the Supabase env vars exist prerenders the "not signed in"
 * redirect and bakes it in permanently, so the page keeps sending people to
 * /login even after credentials are added.
 */
export const dynamic = "force-dynamic";

import { CalendarClock, FileText, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { Badge, ButtonLink, Card, Container, Eyebrow, Rule, Section } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listPlansForUser } from "@/lib/diet/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOAL_LABEL } from "@/lib/diet/constants";
import { formatDateIST, formatINR, formatTime24to12 } from "@/lib/utils";

export const metadata: Metadata = { title: "My dashboard" };

export default async function DashboardPage() {
  const profile = await requireUser();
  const admin = createAdminClient();

  const plans = await listPlansForUser(profile.id);

  const [orders, bookings] = await Promise.all([
    admin
      ? admin
          .from("orders")
          .select("id, tier_name_snapshot, amount_paise, status, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(10)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    admin
      ? admin
          .from("bookings")
          .select("id, slot_date, slot_start, status, coach_id, coaches(name, kind)")
          .eq("user_id", profile.id)
          .order("slot_date", { ascending: false })
          .limit(10)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  return (
    <Section>
      <Container>
        <Reveal>
          <Eyebrow>Account</Eyebrow>
          <h1 className="mt-3 font-display text-h2 text-bone">
            {profile.full_name ? `HELLO, ${profile.full_name.split(" ")[0].toUpperCase()}` : "MY DASHBOARD"}
          </h1>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Plans */}
          <Reveal>
            <Card>
              <h2 className="flex items-center gap-2 font-display text-h4 text-bone">
                <FileText className="size-4 text-blood" aria-hidden="true" />
                My diet charts
              </h2>
              <Rule className="my-5" />

              {plans.length === 0 ? (
                <div className="text-caption text-ash">
                  <p>No charts yet.</p>
                  <ButtonLink href="/diet" className="mt-4">
                    Build my first chart
                  </ButtonLink>
                </div>
              ) : (
                <ul className="space-y-4">
                  {plans.map((plan) => (
                    <li key={plan.id} className="flex items-center justify-between gap-4">
                      <div>
                        <Link
                          href={`/diet/${plan.id}`}
                          className="font-display text-sm uppercase tracking-[0.06em] text-bone hover:text-blood-bright"
                        >
                          {GOAL_LABEL[plan.goal]} · {plan.targetKcal} kcal
                        </Link>
                        <p className="text-[0.7rem] text-ash-dim">
                          BMI {plan.bmi} · {plan.dietType.replace("_", "-")} ·{" "}
                          {formatDateIST(plan.createdAt)}
                        </p>
                      </div>
                      <ButtonLink href={`/diet/${plan.id}`} variant="outline" className="shrink-0 px-5 py-2">
                        Open
                      </ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          {/* Orders */}
          <Reveal delay={0.08}>
            <Card>
              <h2 className="flex items-center gap-2 font-display text-h4 text-bone">
                <Receipt className="size-4 text-blood" aria-hidden="true" />
                Orders
              </h2>
              <Rule className="my-5" />

              {orders.length === 0 ? (
                <p className="text-caption text-ash">No purchases yet.</p>
              ) : (
                <ul className="space-y-4">
                  {orders.map((order) => (
                    <li key={order.id as string} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-caption text-bone">{order.tier_name_snapshot as string}</p>
                        <p className="text-[0.7rem] text-ash-dim">
                          {formatDateIST(order.created_at as string)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-caption tabular-nums text-ash">
                          {formatINR(order.amount_paise as number)}
                        </span>
                        <Badge tone={order.status === "paid" ? "good" : "neutral"}>
                          {order.status as string}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          {/* Bookings */}
          <Reveal delay={0.12} className="lg:col-span-2">
            <Card>
              <h2 className="flex items-center gap-2 font-display text-h4 text-bone">
                <CalendarClock className="size-4 text-blood" aria-hidden="true" />
                Consultations
              </h2>
              <Rule className="my-5" />

              {bookings.length === 0 ? (
                <div className="text-caption text-ash">
                  <p>No sessions booked.</p>
                  <ButtonLink href="/book" className="mt-4">
                    Book a consult
                  </ButtonLink>
                </div>
              ) : (
                <ul className="space-y-4">
                  {bookings.map((booking) => {
                    const coach = booking.coaches as { name?: string; kind?: string } | null;
                    return (
                      <li
                        key={booking.id as string}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-caption text-bone">
                            {coach?.name ?? "Coach"}{" "}
                            <span className="text-ash">({coach?.kind ?? "coach"})</span>
                          </p>
                          <p className="text-[0.7rem] text-ash-dim">
                            {formatDateIST(booking.slot_date as string)} at{" "}
                            {formatTime24to12(String(booking.slot_start).slice(0, 5))} IST
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            tone={
                              booking.status === "confirmed"
                                ? "good"
                                : booking.status === "cancelled"
                                  ? "blood"
                                  : "neutral"
                            }
                          >
                            {booking.status as string}
                          </Badge>
                          <ButtonLink
                            href={`/book/${booking.id}`}
                            variant="outline"
                            className="px-5 py-2"
                          >
                            Details
                          </ButtonLink>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.16} className="mt-10">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="font-display text-caption uppercase tracking-[0.16em] text-ash transition-colors hover:text-blood-bright"
            >
              Sign out
            </button>
          </form>
        </Reveal>
      </Container>
    </Section>
  );
}
