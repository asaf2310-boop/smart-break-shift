import { getGuestLinkTtlSec } from "./guestLinkToken.js";

/** @type {Map<string, number>} token -> expiresAtMs */
const usedTokens = new Map();

function oneTimeEnabled() {
  return String(process.env.GUEST_LINK_ONE_TIME || "").trim().toLowerCase() === "true";
}

function pruneExpired(now = Date.now()) {
  for (const [token, expiresAt] of usedTokens.entries()) {
    if (expiresAt <= now) usedTokens.delete(token);
  }
}

/**
 * Serverless best-effort: in-memory set of consumed guest link tokens.
 * Not shared across instances — document limitation when GUEST_LINK_ONE_TIME=true.
 */
export function isGuestLinkTokenConsumed(token) {
  if (!oneTimeEnabled()) return false;
  const key = String(token || "").trim();
  if (!key) return false;
  pruneExpired();
  const expiresAt = usedTokens.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    usedTokens.delete(key);
    return false;
  }
  return true;
}

export function markGuestLinkTokenConsumed(token) {
  if (!oneTimeEnabled()) return;
  const key = String(token || "").trim();
  if (!key) return;
  pruneExpired();
  const ttlMs = Math.max(60, getGuestLinkTtlSec()) * 1000;
  usedTokens.set(key, Date.now() + ttlMs);
}

export function guestLinkOneTimeEnabled() {
  return oneTimeEnabled();
}
