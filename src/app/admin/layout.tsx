/**
 * Never prerendered.
 *
 * The output depends entirely on who is signed in. Without this, a build that
 * runs before the Supabase env vars exist prerenders the "not signed in"
 * redirect and bakes it in permanently, so the page keeps sending people to
 * /login even after credentials are added.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { ReactNode } from "react";

import { LogoBadge } from "@/components/brand/logo";
import { requireStaffOrDemo } from "@/lib/auth";

import { AdminNav } from "./admin-nav";

export const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/diet-requests", label: "Intakes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/coaches", label: "Coaches" },
  { href: "/admin/transformations", label: "Gallery" },
  { href: "/admin/users", label: "People" },
  { href: "/admin/events", label: "Payment log" },
  { href: "/admin/system", label: "System" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, demo } = await requireStaffOrDemo();

  return (
    <div className="min-h-dvh bg-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-ink/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-[--container-page] flex-wrap items-center justify-between gap-4 px-(--spacing-gutter) py-4">
          <div className="flex items-center gap-3">
            <LogoBadge size={36} />
            <div>
              <p className="font-display text-[0.8rem] uppercase tracking-[0.2em] text-bone">
                Admin console
              </p>
              <p className="text-[0.68rem] text-ash">
                {demo ? "Preview mode · not signed in" : `${profile?.full_name ?? "Staff"} · ${profile?.role}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-display text-[0.7rem] uppercase tracking-[0.14em] text-ash transition-colors hover:text-bone"
            >
              View site
            </Link>
            {!demo ? (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="font-display text-[0.7rem] uppercase tracking-[0.14em] text-ash transition-colors hover:text-blood-bright"
                >
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <AdminNav items={NAV} />
      </header>

      <main className="mx-auto w-full max-w-[--container-page] px-(--spacing-gutter) py-10">
        {children}
      </main>
    </div>
  );
}
