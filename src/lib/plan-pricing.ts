import "server-only";

import { findTier, type PlanTier } from "@/lib/data/content";

/**
 * The ONLY place an order amount may come from.
 *
 * The client sends a tier slug and nothing else — any amount it supplies is
 * discarded before it is even read. This is the same discipline as re-pricing a
 * cart server-side: the browser is allowed to say *what* it wants to buy, never
 * *what it costs*.
 */
export function resolvePlanPrice(tierSlug: string): PlanTier {
  const tier = findTier(tierSlug);
  if (!tier) {
    throw new Error(`Unknown plan tier: ${tierSlug}`);
  }
  if (!Number.isInteger(tier.pricePaise) || tier.pricePaise <= 0) {
    throw new Error(`Tier ${tierSlug} has an invalid price`);
  }
  return tier;
}
