/** In-memory one-time SIP credential token nonces (serverless best-effort). */

const redeemedNonces = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [nonce, expiresAtMs] of redeemedNonces) {
    if (expiresAtMs <= now) redeemedNonces.delete(nonce);
  }
}

/**
 * @param {string} nonce
 * @param {number} expSec — token expiry (unix seconds)
 * @returns {boolean} true if marked fresh; false if already redeemed
 */
export function consumeSipCredentialNonce(nonce, expSec) {
  const key = String(nonce || "").trim();
  if (!key) return false;
  pruneExpired();
  if (redeemedNonces.has(key)) return false;
  const ttlMs = Math.max(60_000, (Number(expSec) || 0) * 1000 - Date.now() + 60_000);
  redeemedNonces.set(key, Date.now() + ttlMs);
  return true;
}
