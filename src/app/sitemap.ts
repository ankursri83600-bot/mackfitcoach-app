import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

/**
 * Public marketing surface only.
 *
 * Anything behind auth, behind the paywall, or unique to one visitor is
 * deliberately absent: /admin, /dashboard, /login, /register, /auth, /checkout
 * and /diet/[planId] are all either private or per-user, and listing them
 * invites crawlers to hammer routes that can only ever answer 401/403.
 */
const routes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/diet", changeFrequency: "weekly", priority: 0.9 },
  { path: "/plans", changeFrequency: "weekly", priority: 0.9 },
  { path: "/transformations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/coaches", changeFrequency: "monthly", priority: 0.7 },
  { path: "/book", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, siteConfig.url).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
