import { demoModeEnabled } from "@/api/demoMode";

/** Demo-only keys that must never be read in production builds. */
export const DEMO_LOCAL_STORAGE_KEYS = [
  "smart-break-shift-demo-store-v1",
  "smart-break-shift-demo-store",
  "smart_break_admin_unlocked",
];

/**
 * Production builds must not read or write demo offline DB keys.
 * @returns {boolean}
 */
export function isDemoLocalStorageAllowed() {
  return demoModeEnabled;
}

/**
 * Remove demo-only localStorage keys on production boot (one-time hygiene).
 */
export function purgeDemoLocalStorageInProduction() {
  if (typeof window === "undefined" || demoModeEnabled) return;
  try {
    for (const key of DEMO_LOCAL_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore private mode */
  }
}
