import { getGuestLinkTtlSec } from "./guestLinkToken.js";

/** @type {Map<string, number>} token -> expiresAtMs */
const usedTokens = new Map();

function oneTimeEnabled() {
  const raw = String(process.env.GUEST_LINK_ONE_TIME ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0";
}

function pruneExpired(now = Date.now()) {
  for (const [token, expiresAt] of usedTokens.entries()) {
    if (expiresAt <= now) usedTokens.delete(token);
  }
}

/**
 * Serverless best-effort: in-memory set of consumed guest link tokens.
 * Fallback when guest_link_redemptions table is unavailable.
 * Phase 14: persistent redemption via Supabase when security_phase14 SQL is applied.
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
