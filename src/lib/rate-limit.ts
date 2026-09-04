/**
 * In-process sliding-window rate limiter.
 *
 * Deliberately simple, and deliberately caveated: this state is per-instance, so
 * it does NOT hold across a multi-instance or serverless deployment. It exists to
 * stop one client hammering the Razorpay order endpoint (real API quota, real
 * dashboard noise), not as a security boundary. Move it to Postgres or Upstash
 * before scaling out.
 */
const buckets = globalThis as typeof globalThis & {
  __mfcRateBuckets?: Map<string, number[]>;
};
buckets.__mfcRateBuckets ??= new Map<string, number[]>();
const store = buckets.__mfcRateBuckets;

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    store.set(key, hits);
    return false;
  }

  hits.push(now);
  store.set(key, hits);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.every((t) => t <= cutoff)) store.delete(k);
    }
  }
  return true;
}
