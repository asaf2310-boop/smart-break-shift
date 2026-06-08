/**
 * Remote support (browser screen share + RustDesk) — production-safe module.
 * Enabled by default in live builds; opt-out: VITE_REMOTE_SUPPORT_ENABLED=false
 */
export const remoteSupportEnabled =
  import.meta.env.VITE_REMOTE_SUPPORT_ENABLED !== "false";
