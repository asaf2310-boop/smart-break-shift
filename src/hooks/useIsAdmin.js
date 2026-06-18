import { useAgentSession } from "@/hooks/useAgentSession";

/** @deprecated Demo PIN unlock removed (phase 16). */
export function isAdminPinConfigured() {
  return false;
}

/** @deprecated */
export function isDemoAdminPinRequired() {
  return false;
}

/** @deprecated */
export function isProductionAdminOpen() {
  return false;
}

/** @deprecated Demo PIN unlock removed — use session.isAdmin. */
export function isDemoAdminUnlocked() {
  return false;
}

/** @deprecated */
export function isAdminSessionActive() {
  return false;
}

/** @deprecated No-op — kept for logout cleanup compatibility. */
export function unlockAdminSession() {
  /* removed phase 16 */
}

/** @deprecated No-op — kept for logout cleanup compatibility. */
export function clearAdminSession() {
  /* removed phase 16 */
}

/**
 * Admin UI permissions — production and demo: agents.is_admin from session.
 */
export function useIsAdmin() {
  const { session, isLoggedIn } = useAgentSession();
  return Boolean(isLoggedIn && session?.isAdmin === true);
}
