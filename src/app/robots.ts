import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

/**
 * The disallow list is defence in depth, not access control — RLS and
 * `src/lib/entitlements.ts` are what actually stop a stranger reading a plan.
 * This just keeps private and per-user routes out of search results, and keeps
 * crawlers off routes that can only answer with a redirect or a 403.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/checkout", "/auth", "/api", "/diet/"],
    },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
    host: siteConfig.url,
  };
}
