"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Horizontal section nav. Client-side only so the active tab can be derived from
 * the pathname without threading it through every page.
 */
export function AdminNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mx-auto w-full max-w-[--container-page] overflow-x-auto px-(--spacing-gutter)"
      data-lenis-prevent
    >
      <ul className="flex min-w-max gap-1 pb-px">
        {items.map((item) => {
          // /admin must not match every child route.
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block whitespace-nowrap px-4 py-3 font-display text-[0.7rem] uppercase tracking-[0.14em] transition-colors",
                  active ? "text-bone" : "text-ash hover:text-bone",
                )}
              >
                {item.label}
                {active ? (
                  <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 bg-blood" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
