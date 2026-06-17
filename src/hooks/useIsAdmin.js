import { useSyncExternalStore } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import { useAgentSession } from "@/hooks/useAgentSession";

const ADMIN_SESSION_KEY = "smart_break_admin_unlocked";

/** Demo-only: hardcoded PIN for local preview (never from VITE_* env). */
export const DEMO_ADMIN_PIN = "1234";

/** @deprecated Use isDemoAdminUnlocked / useIsAdmin instead. */
export function isAdminPinConfigured() {
  return demoModeEnabled;
}

/** @deprecated */
export function isDemoAdminPinRequired() {
  return demoModeEnabled;
}

/** @deprecated */
export function isProductionAdminOpen() {
  return false;
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

/** Demo: local admin UI unlock flag (not used in production). */
export function isDemoAdminUnlocked() {
  return demoModeEnabled && getAdminSessionSnapshot();
}

/** @deprecated Prefer useIsAdmin. */
export function isAdminSessionActive() {
  return isDemoAdminUnlocked();
}

export function unlockAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("admin-session-changed"));
}

/**
 * Admin UI permissions — production: agents.is_admin from server session.
 * Demo: local unlock flag after demo PIN.
 */
export function useIsAdmin() {
  const { session, isLoggedIn } = useAgentSession();
  const demoUnlocked = useSyncExternalStore(
    subscribeAdminSession,
    getAdminSessionSnapshot,
    () => false
  );

  if (demoModeEnabled) {
    return demoUnlocked;
  }

  return Boolean(isLoggedIn && session?.isAdmin === true);
}
