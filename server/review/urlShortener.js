/** External URL shortener for review SMS links (is.gd → tinyurl fallback). */

const IS_GD_API = "https://is.gd/create.php";
const TINYURL_API = "https://tinyurl.com/api-create.php";
const SHORTENER_TIMEOUT_MS = 20_000;

async function fetchShortenerText(apiUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHORTENER_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
    const text = String(await response.text()).trim();
    if (!response.ok) {
      return { ok: false, error: text || `HTTP ${response.status}` };
    }
    if (!text.startsWith("http://") && !text.startsWith("https://")) {
      return { ok: false, error: text || "invalid_response" };
    }
    return { ok: true, url: text };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return { ok: false, error: aborted ? "timeout" : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function tryIsGd(longUrl) {
  const apiUrl = `${IS_GD_API}?format=simple&url=${encodeURIComponent(longUrl)}`;
  const result = await fetchShortenerText(apiUrl);
  if (!result.ok) {
    console.warn("[urlShortener] is.gd", result.error);
    return { ok: false };
  }
  return { ok: true, url: result.url, provider: "is.gd" };
}

async function tryTinyUrl(longUrl) {
  const apiUrl = `${TINYURL_API}?url=${encodeURIComponent(longUrl)}`;
  const result = await fetchShortenerText(apiUrl);
  if (!result.ok) {
    console.warn("[urlShortener] tinyurl", result.error);
    return { ok: false };
  }
  return { ok: true, url: result.url, provider: "tinyurl" };
}

/**
 * Shorten a long review URL for SMS.
 * @param {string} longUrl
 * @returns {Promise<{ ok: true, url: string, provider: string } | { ok: false, error: string, message: string }>}
 */
export async function shortenUrlForSms(longUrl) {
  const url = String(longUrl || "").trim();
  if (!url) {
    return { ok: false, error: "empty_url", message: "אין קישור לקיצור" };
  }

  const isGd = await tryIsGd(url);
  if (isGd.ok) {
    return { ok: true, url: isGd.url, provider: isGd.provider };
  }

  const tiny = await tryTinyUrl(url);
  if (tiny.ok) {
    return { ok: true, url: tiny.url, provider: tiny.provider };
  }

  return {
    ok: false,
    error: "shorten_failed",
    message: "לא הצלחנו לקצר את הקישור. נסו שוב או הדביקו קישור g.page קצר.",
  };
}
