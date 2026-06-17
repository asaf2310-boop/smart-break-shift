const STORAGE_PREFIX = "guest-link-token:";

export function saveGuestLinkToken(sessionId, token) {
  if (!sessionId || !token || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, String(token));
  } catch {
    /* quota / private mode */
  }
}

export function getGuestLinkToken(sessionId) {
  if (!sessionId || typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`) || null;
  } catch {
    return null;
  }
}
