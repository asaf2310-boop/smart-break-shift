const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

/**
 * In-memory per-IP rate limiter (serverless best-effort).
 * @param {Map<string, { count: number, resetAt: number }>} store
 */
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function checkIpRateLimit(store, ip, max, windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(ip, entry);
  }
  if (entry.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, entry };
}

export function recordIpRateLimit(entry) {
  if (entry) entry.count += 1;
}
