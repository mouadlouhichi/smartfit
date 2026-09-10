/**
 * A tiny fixed-window rate limiter, used to keep the coach proxy from being
 * farmed by strangers. Deliberately in-process: on a serverless platform each
 * instance keeps its own counters, so this is a speed bump (worth ~a minute of
 * abuse) rather than a guarantee. Anything stronger needs shared storage.
 */
export interface RateLimiter {
  /** True when the caller is under the limit; counts the hit either way. */
  allow(key: string, now?: number): boolean;
  /** Tracked keys — exposed for tests and for a sanity check on the route. */
  readonly size: number;
  reset(): void;
}

export function createRateLimiter({
  max,
  windowMs,
  maxKeys = 5000,
}: {
  max: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }

  return {
    allow(key: string, now = Date.now()): boolean {
      // A flood of unique keys would otherwise grow the map without bound.
      if (hits.size > maxKeys) prune(now);
      const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      const allowed = times.length < max;
      times.push(now);
      hits.set(key, times);
      return allowed;
    },
    get size() {
      return hits.size;
    },
    reset() {
      hits.clear();
    },
  };
}
