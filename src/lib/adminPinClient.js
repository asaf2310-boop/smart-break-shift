const ADMIN_PIN_SESSION_KEY = "smart_break_admin_pin_for_api";

/** Remember admin PIN in session for server API calls from /admin pages. */
export function rememberAdminPinForApi(pin) {
  try {
    if (pin) {
      sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, String(pin));
    } else {
      sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getAdminPinForApi() {
  try {
    return sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || "";
  } catch {
    return "";
  }
}
