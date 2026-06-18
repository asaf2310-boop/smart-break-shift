const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

/**
 * In-memory rate limiter (serverless best-effort).
 * @param {Map<string, { count: number, resetAt: number }>} store
 */
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

/** Prefer authenticated user id; fallback to client IP. */
export function getRateLimitKey(req, userId) {
  const uid = String(userId || "").trim();
  if (uid) return `user:${uid}`;
  return `ip:${getClientIp(req)}`;
}

export function checkRateLimit(store, key, max, windowMs = DEFAULT_WINDOW_MS) {
  const rateKey = String(key || "").trim() || "unknown";
  const now = Date.now();
  let entry = store.get(rateKey);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(rateKey, entry);
  }
  if (entry.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, entry };
}

export function recordRateLimit(entry) {
  if (entry) entry.count += 1;
}

/** @deprecated use checkRateLimit with `ip:${ip}` key */
export function checkIpRateLimit(store, ip, max, windowMs = DEFAULT_WINDOW_MS) {
  return checkRateLimit(store, `ip:${ip}`, max, windowMs);
}

/** @deprecated use recordRateLimit */
export function recordIpRateLimit(entry) {
  recordRateLimit(entry);
}

export function rateLimitHebrewMessage(retryAfterSec) {
  const sec = Math.max(1, Number(retryAfterSec) || 1);
  return `יותר מדי בקשות — נסו שוב בעוד ${sec} שניות`;
}

/** Set standard rate-limit response headers (Retry-After). */
export function setRateLimitHeaders(res, retryAfterSec) {
  const sec = Math.max(1, Number(retryAfterSec) || 1);
  res.setHeader("Retry-After", String(sec));
  return sec;
}
