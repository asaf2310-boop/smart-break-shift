import { clearGuestLinkToken } from "@/lib/guestLinkTokenStore";
import { clearWebrtcJoinToken } from "@/lib/webrtcJoinTokenStore";

/** Guest / WebRTC token errors that should drop cached client tokens. */
const STALE_GUEST_AUTH_ERRORS = new Set([
  "expired",
  "ended",
  "already_used",
  "fingerprint_mismatch",
  "invalid_token",
  "session_mismatch",
]);

export function isStaleGuestAuthError(error) {
  return STALE_GUEST_AUTH_ERRORS.has(String(error || "").trim());
}

/** Remove per-session guest + WebRTC join tokens after expiry or session end. */
export function purgeStaleGuestSessionTokens(sessionId) {
  if (!sessionId) return;
  clearGuestLinkToken(sessionId);
  clearWebrtcJoinToken(sessionId);
}
