// Best-effort, in-memory sliding-window rate limiter.
//
// Vercel serverless functions are stateless and can run across multiple
// instances, so this only rate-limits requests that happen to land on the
// same warm instance — it is a defense-in-depth layer against casual abuse
// (brute-forced logins, hammering the sync endpoint), not a hard guarantee.
// For strict, cross-instance rate limiting, back this with a shared store
// such as Upstash Redis (@upstash/ratelimit) instead.

const buckets = new Map();

// Periodically drop old buckets so this doesn't leak memory on a
// long-lived instance.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > SWEEP_INTERVAL_MS) buckets.delete(key);
  }
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns { allowed, remaining, retryAfterMs }. `key` should uniquely
 * identify the caller + action, e.g. `login:${ip}` or `sync:${ip}`.
 */
export function checkRateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const allowed = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterMs = allowed ? 0 : windowMs - (now - bucket.windowStart);

  return { allowed, remaining, retryAfterMs };
}
