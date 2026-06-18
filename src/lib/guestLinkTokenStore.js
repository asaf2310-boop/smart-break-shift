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

export function clearAllGuestLinkTokens() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
  if (typeof localStorage === "undefined") return;
  try {
    const legacyKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) legacyKeys.push(key);
    }
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
