"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { useLockScroll } from "@/components/motion/smooth-scroll-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/diet", label: "Get your plan" },
  { href: "/transformations", label: "Transformations" },
  { href: "/plans", label: "Pricing" },
  { href: "/coaches", label: "Coaches" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader({ authSlot }: { authSlot?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useLockScroll(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full print:hidden transition-all duration-300",
        scrolled ? "border-b border-hairline bg-ink/85 backdrop-blur-lg" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-20 w-full max-w-[--container-page] items-center justify-between px-(--spacing-gutter)">
        <Logo variant="lockup" size={44} priority />

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative font-display text-[0.78rem] tracking-[0.16em] uppercase transition-colors duration-200",
                  active ? "text-blood-bright" : "text-bone/80 hover:text-bone",
                )}
              >
                {item.label}
                {active ? (
                  <span aria-hidden="true" className="absolute -bottom-1.5 left-0 h-px w-full bg-blood" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {authSlot ?? (
            <Link
              href="/login"
              className="font-display text-[0.78rem] tracking-[0.16em] uppercase text-bone/80 transition-colors hover:text-bone"
            >
              Log in
            </Link>
          )}
          <Link
            href="/book"
            className="rounded-pill bg-blood px-6 py-3 font-display text-[0.78rem] tracking-[0.16em] uppercase text-bone transition-colors duration-200 hover:bg-blood-bright"
          >
            Book a call
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-11 place-items-center rounded-sm border border-hairline text-bone lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          data-lenis-prevent
          className="border-t border-hairline bg-ink px-(--spacing-gutter) pb-8 pt-4 lg:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-hairline py-4 font-display text-lg tracking-[0.06em] uppercase text-bone"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/dashboard" className="py-4 font-display text-lg uppercase text-bone/70">
              My account
            </Link>
            <Link
              href="/book"
              className="mt-3 rounded-pill bg-blood px-6 py-3.5 text-center font-display text-sm tracking-[0.16em] uppercase text-bone"
            >
              Book a call
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
