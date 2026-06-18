const STORAGE_PREFIX = "webrtc-join-token:";

export function saveWebrtcJoinToken(sessionId, token) {
  if (!sessionId || !token || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, String(token));
  } catch {
    /* quota / private mode */
  }
}

export function getWebrtcJoinToken(sessionId) {
  if (!sessionId || typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`) || null;
  } catch {
    return null;
  }
}

export function clearWebrtcJoinToken(sessionId) {
  if (!sessionId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
  } catch {
    /* ignore */
  }
}

export function clearAllWebrtcJoinTokens() {
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
}
