"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the marketing chrome on routes that supply their own.
 *
 * The admin console has its own header and section nav, so the public site
 * header, footer and entry preloader must not stack on top of it. Server
 * components are passed in as children and simply not rendered on those routes.
 */
const OWN_CHROME = ["/admin"];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (OWN_CHROME.some((prefix) => pathname.startsWith(prefix))) return null;
  return <>{children}</>;
}
