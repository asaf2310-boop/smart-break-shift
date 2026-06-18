import { isUpstashConfigured, upstashPipeline } from "./upstashRedis.js";

export function isUpstashRateLimitEnabled() {
  return isUpstashConfigured();
}

/**
 * Fixed-window rate limit via Upstash Redis (shared across serverless instances).
 * Returns null when Upstash is not configured — caller should use in-memory fallback.
 *
 * @param {string} prefix — namespace, e.g. "password_reset"
 * @param {string} identifier — ip:… or user:…
 * @param {number} max — max requests per window
 * @param {number} windowMs — window length in ms
 * @returns {Promise<{ allowed: boolean, retryAfterSec: number } | null>}
 */
export async function checkDistributedRateLimit(prefix, identifier, max, windowMs) {
  if (!isUpstashConfigured()) return null;

  const id = String(identifier || "").trim() || "unknown";
  const limit = Math.max(1, Number(max) || 1);
  const windowSec = Math.max(1, Math.ceil((Number(windowMs) || 60_000) / 1000));
  const windowId = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${prefix}:${id}:${windowId}`;

  try {
    const results = await upstashPipeline([
      ["INCR", key],
      ["TTL", key],
    ]);
    const count = Number(results[0]?.result);
    let ttl = Number(results[1]?.result);

    if (!Number.isFinite(count) || count < 1) {
      return null;
    }

    if (ttl < 0) {
      await upstashPipeline([["EXPIRE", key, String(windowSec + 1)]]);
      ttl = windowSec;
    }

    if (count > limit) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Number.isFinite(ttl) && ttl > 0 ? ttl : windowSec),
      };
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn("[distributedRateLimit] Upstash fallback to in-memory:", err?.message || err);
    return null;
  }
}

/** @returns {'upstash' | 'memory'} */
export function getRateLimitBackend() {
  return isUpstashConfigured() ? "upstash" : "memory";
}
