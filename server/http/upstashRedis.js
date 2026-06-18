/**
 * Minimal Upstash Redis REST client (no npm dependency).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel.
 */

export function isUpstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function getConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

/**
 * @param {unknown[][]} commands — e.g. [["INCR", "key"], ["TTL", "key"]]
 * @returns {Promise<Array<{ result?: unknown, error?: string }>>}
 */
export async function upstashPipeline(commands) {
  const cfg = getConfig();
  if (!cfg || !commands?.length) return [];

  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    throw new Error(`upstash_http_${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
