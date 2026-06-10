<<<<<<< HEAD
import { useSyncExternalStore } from "react";
import { demoModeEnabled } from "@/api/demoClient";

const ADMIN_SESSION_KEY = "smart_break_admin_unlocked";

/** PIN מוגדר ב-build env (VITE_ADMIN_PIN). */
export function isAdminPinConfigured() {
  return Boolean(String(import.meta.env.VITE_ADMIN_PIN ?? "").trim());
}

/** דמו בלבד: נדרש PIN רק כשהוגדר ב-build. */
export function isDemoAdminPinRequired() {
  return demoModeEnabled && isAdminPinConfigured();
}

/** פרודקשן: /admin פתוח בלי PIN כשאין VITE_ADMIN_PIN ב-build (לא משפיע על ניווט נציג). */
export function isProductionAdminOpen() {
  return !demoModeEnabled && !isAdminPinConfigured();
}

function subscribeAdminSession(onStoreChange) {
  const onStorage = (e) => {
    if (e.key === ADMIN_SESSION_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("admin-session-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("admin-session-changed", onStoreChange);
  };
}

function getAdminSessionSnapshot() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

/** מצב מנהל פעיל — רק אחרי הזנת PIN במסך /admin (לא התחברות נציג). */
export function isAdminSessionActive() {
  return isAdminPinConfigured() && getAdminSessionSnapshot();
}

export function unlockAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

/** ניווט/הרשאות UI — רק אחרי PIN מוצלח; לא כולל isProductionAdminOpen. */
export function useIsAdmin() {
  const sessionUnlocked = useSyncExternalStore(
    subscribeAdminSession,
    getAdminSessionSnapshot,
    () => false
  );
  return isAdminPinConfigured() && sessionUnlocked;
}
=======
import { useSyncExternalStore } from "react";
import { demoModeEnabled } from "@/api/demoClient";

const ADMIN_SESSION_KEY = "smart_break_admin_unlocked";

/** PIN מוגדר ב-build env (VITE_ADMIN_PIN). */
export function isAdminPinConfigured() {
  return Boolean(String(import.meta.env.VITE_ADMIN_PIN ?? "").trim());
}

/** דמו בלבד: נדרש PIN רק כשהוגדר ב-build. */
export function isDemoAdminPinRequired() {
  return demoModeEnabled && isAdminPinConfigured();
}

/** פרודקשן: /admin פתוח בלי PIN כשאין VITE_ADMIN_PIN ב-build (לא משפיע על ניווט נציג). */
export function isProductionAdminOpen() {
  return !demoModeEnabled && !isAdminPinConfigured();
}

function subscribeAdminSession(onStoreChange) {
  const onStorage = (e) => {
    if (e.key === ADMIN_SESSION_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("admin-session-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("admin-session-changed", onStoreChange);
  };
}

function getAdminSessionSnapshot() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

/** מצב מנהל פעיל — רק אחרי הזנת PIN במסך /admin (לא התחברות נציג). */
export function isAdminSessionActive() {
  return isAdminPinConfigured() && getAdminSessionSnapshot();
}

export function unlockAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

/** ניווט/הרשאות UI — רק אחרי PIN מוצלח; לא כולל isProductionAdminOpen. */
export function useIsAdmin() {
  const sessionUnlocked = useSyncExternalStore(
    subscribeAdminSession,
    getAdminSessionSnapshot,
    () => false
  );
  return isAdminPinConfigured() && sessionUnlocked;
}
>>>>>>> 842dd9e (Initial commit)
