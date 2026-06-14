/** Shared exponential backoff for OpenAI API calls (429 / 503). */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response) {
  const header = response.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.min(dateMs - Date.now(), 60_000));
  return null;
}

function isRetryableStatus(status) {
  return status === 429 || status === 503;
}

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ maxRetries?: number, initialDelayMs?: number, maxDelayMs?: number }} [config]
 * @returns {Promise<Response>}
 */
export async function fetchOpenAiWithRetry(url, options, config = {}) {
  const maxRetries = config.maxRetries ?? 3;
  const initialDelayMs = config.initialDelayMs ?? 1000;
  const maxDelayMs = config.maxDelayMs ?? 20_000;

  let lastResponse = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    lastResponse = await fetch(url, options);

    if (!isRetryableStatus(lastResponse.status) || attempt >= maxRetries) {
      return lastResponse;
    }

    const retryAfterMs = parseRetryAfterMs(lastResponse) ?? initialDelayMs * 2 ** attempt;
    await sleep(Math.min(maxDelayMs, retryAfterMs));
  }

  return lastResponse;
}

export function getRetryAfterSec(response) {
  const ms = parseRetryAfterMs(response);
  return ms ? Math.max(1, Math.ceil(ms / 1000)) : null;
}
