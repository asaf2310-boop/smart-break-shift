import { demoModeEnabled } from "@/api/demoMode";

const AGENT_SESSION_KEY = "smart-break-agent-session-v1";
const LEGACY_AGENT_NAME_KEY = "agent_name";
const SCREEN_SHARE_STORAGE_KEY = "smart-break-shift-screen-share-v1";
const REMOTE_SUPPORT_STORAGE_KEY = "smart-break-shift-remote-support-v1";

export function getAgentSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getSupportSessionStorage(demoMode) {
  if (typeof window === "undefined") return null;
  return demoMode ? window.localStorage : window.sessionStorage;
}

export function readJson(storage, key) {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(storage, key, value) {
  if (!storage || !key) return;
  storage.setItem(key, JSON.stringify(value));
}

export function removeKey(storage, key) {
  if (!storage || !key) return;
  storage.removeItem(key);
}

export function sanitizeSupportSessionForPersist(session, { demoMode }) {
  if (!session || typeof session !== "object") return session;
  if (demoMode) return session;
  const { password: _password, ...rest } = session;
  return rest;
}

function stripPasswordsFromRemoteSupportPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (!Array.isArray(parsed.sessions)) return parsed;
  return {
    ...parsed,
    sessions: parsed.sessions.map((session) =>
      sanitizeSupportSessionForPersist(session, { demoMode: false })
    ),
  };
}

/**
 * One-time migration on app boot: agent session → sessionStorage;
 * production support stores → sessionStorage; strip legacy keys and passwords.
 */
export function migrateLegacyBrowserStorage() {
  if (typeof window === "undefined") return;

  const { sessionStorage, localStorage } = window;

  if (!sessionStorage.getItem(AGENT_SESSION_KEY)) {
    const legacyAgentSession = localStorage.getItem(AGENT_SESSION_KEY);
    if (legacyAgentSession) {
      sessionStorage.setItem(AGENT_SESSION_KEY, legacyAgentSession);
    }
  }
  localStorage.removeItem(AGENT_SESSION_KEY);
  localStorage.removeItem(LEGACY_AGENT_NAME_KEY);

  if (!demoModeEnabled) {
    for (const key of [SCREEN_SHARE_STORAGE_KEY, REMOTE_SUPPORT_STORAGE_KEY]) {
      if (!sessionStorage.getItem(key)) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          let migrated = legacy;
          if (key === REMOTE_SUPPORT_STORAGE_KEY) {
            try {
              migrated = JSON.stringify(
                stripPasswordsFromRemoteSupportPayload(JSON.parse(legacy))
              );
            } catch {
              // keep raw payload if parse fails
            }
          }
          sessionStorage.setItem(key, migrated);
        }
      }
      localStorage.removeItem(key);
    }
  }
}
