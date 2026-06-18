import { demoModeEnabled } from "@/api/demoMode";
import { purgeDemoLocalStorageInProduction } from "@/lib/demoStorageGuard";
import { clearAllGuestLinkTokens } from "@/lib/guestLinkTokenStore";
import { clearAllWebrtcJoinTokens } from "@/lib/webrtcJoinTokenStore";
import { CRM_STORAGE_KEY } from "@/lib/crmStore";

/**
 * Browser storage policy — production vs demo.
 *
 * Production-safe (sessionStorage after migrateLegacyBrowserStorage):
 *   smart-break-agent-session-v1 — JWT session metadata (no passwords)
 *   smart-break-shift-screen-share-v1 / remote-support — support sessions (passwords stripped)
 *   smart-break-shift-telephony-v1 — call logs / status (no SIP secrets)
 *   smart-break-shift-support-chat-v1 / support-files — session-scoped caches
 *
 * Demo-only (localStorage):
 *   smart-break-shift-demo-store — full offline demo DB
 *   CRM/knowledge/training local caches — see respective *Store.js modules
 *
 * Never persist in browser: admin PIN, SIP passwords, service keys, ADMIN_PIN.
 */
const AGENT_SESSION_KEY = "smart-break-agent-session-v1";
const LEGACY_AGENT_NAME_KEY = "agent_name";
const SCREEN_SHARE_STORAGE_KEY = "smart-break-shift-screen-share-v1";
const REMOTE_SUPPORT_STORAGE_KEY = "smart-break-shift-remote-support-v1";
const TELEPHONY_STORAGE_KEY = "smart-break-shift-telephony-v1";
const SUPPORT_CHAT_STORAGE_KEY = "smart-break-shift-support-chat-v1";
const SUPPORT_FILES_STORAGE_KEY = "smart-break-shift-support-files-v1";
const LEGACY_ADMIN_PIN_KEYS = [
  "admin_pin",
  "smart_break_admin_pin",
  "VITE_ADMIN_PIN",
  "smart-break-admin-pin",
];
const DEMO_ADMIN_UNLOCK_KEY = "smart_break_admin_unlocked";
const CRM_STORAGE_KEY_V2 = "smart-break-shift-crm-v2";
const CRM_REFERRAL_EVENTS_KEY = "smart-break-shift-crm-referral-events-v1";
const CRM_ROUTING_RULES_KEY = "smart-break-shift-crm-routing-rules-v1";
const CRM_DEPARTMENTS_KEY = "smart-break-shift-crm-departments-v1";

export function getAgentSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getSupportSessionStorage(demoMode) {
  if (typeof window === "undefined") return null;
  return demoMode ? window.localStorage : window.sessionStorage;
}

/** Telephony / support chat / files — session-scoped in production. */
export function getSessionScopedStorage(demoMode = demoModeEnabled) {
  return getSupportSessionStorage(demoMode);
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

  for (const legacyPinKey of LEGACY_ADMIN_PIN_KEYS) {
    localStorage.removeItem(legacyPinKey);
    sessionStorage.removeItem(legacyPinKey);
  }

  if (!demoModeEnabled) {
    sessionStorage.removeItem(DEMO_ADMIN_UNLOCK_KEY);
    localStorage.removeItem(DEMO_ADMIN_UNLOCK_KEY);

    const productionSessionKeys = [
      SCREEN_SHARE_STORAGE_KEY,
      REMOTE_SUPPORT_STORAGE_KEY,
      TELEPHONY_STORAGE_KEY,
      SUPPORT_CHAT_STORAGE_KEY,
      SUPPORT_FILES_STORAGE_KEY,
    ];

    for (const key of productionSessionKeys) {
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

  clearLegacyGuestLinkTokensFromLocalStorage();
  purgeDemoLocalStorageInProduction();
}

function clearLegacyGuestLinkTokensFromLocalStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("guest-link-token:")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/**
 * Clear sensitive client-side caches on agent logout (incremental hardening).
 */
export function clearSensitiveClientStorage() {
  if (typeof window === "undefined") return;

  const { sessionStorage, localStorage } = window;

  removeKey(sessionStorage, AGENT_SESSION_KEY);
  removeKey(sessionStorage, SCREEN_SHARE_STORAGE_KEY);
  removeKey(sessionStorage, REMOTE_SUPPORT_STORAGE_KEY);
  removeKey(sessionStorage, TELEPHONY_STORAGE_KEY);
  removeKey(sessionStorage, SUPPORT_CHAT_STORAGE_KEY);
  removeKey(sessionStorage, SUPPORT_FILES_STORAGE_KEY);
  removeKey(sessionStorage, DEMO_ADMIN_UNLOCK_KEY);

  for (const legacyPinKey of LEGACY_ADMIN_PIN_KEYS) {
    removeKey(localStorage, legacyPinKey);
    removeKey(sessionStorage, legacyPinKey);
  }

  removeKey(localStorage, AGENT_SESSION_KEY);
  removeKey(localStorage, LEGACY_AGENT_NAME_KEY);
  removeKey(localStorage, SCREEN_SHARE_STORAGE_KEY);
  removeKey(localStorage, REMOTE_SUPPORT_STORAGE_KEY);
  removeKey(localStorage, TELEPHONY_STORAGE_KEY);
  removeKey(localStorage, SUPPORT_CHAT_STORAGE_KEY);
  removeKey(localStorage, SUPPORT_FILES_STORAGE_KEY);

  for (const crmKey of [
    CRM_STORAGE_KEY,
    CRM_STORAGE_KEY_V2,
    CRM_REFERRAL_EVENTS_KEY,
    CRM_ROUTING_RULES_KEY,
    CRM_DEPARTMENTS_KEY,
  ]) {
    removeKey(localStorage, crmKey);
  }

  clearAllGuestLinkTokens();
  clearAllWebrtcJoinTokens();
  clearLegacyGuestLinkTokensFromLocalStorage();
}
