import { useAuth } from "@/lib/AuthContext";

const ADMIN_SESSION_KEY = "smart_break_admin_unlocked";

export function unlockAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function useIsAdmin() {
  const { user, isAuthenticated } = useAuth();
  const pinRequired = Boolean(import.meta.env.VITE_ADMIN_PIN);
  const sessionUnlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  const roleAdmin = isAuthenticated && user?.role === "admin";

  if (roleAdmin) return true;
  if (!pinRequired) return true;
  return sessionUnlocked;
}
