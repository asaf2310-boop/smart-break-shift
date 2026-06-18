/** Hebrew labels for security_audit_log.action values (phase 12–13). */

export const SECURITY_AUDIT_ACTION_LABELS = {
  admin_set_password: "הגדרת סיסמה (מנהל)",
  admin_create_break_registration: "יצירת הרשמת הפסקה",
  admin_delete_break_registration: "מחיקת הרשמת הפסקה",
  provision_auth: "הקמת משתמש Auth לנציג",
  guest_link_mint: "יצירת קישור אורח",
  support_session_end: "סיום סשן תמיכה",
  knowledge_upload: "העלאת מסמך ידע",
  knowledge_delete: "מחיקת מסמך ידע",
};

export function securityAuditActionLabel(action) {
  const key = String(action || "").trim();
  return SECURITY_AUDIT_ACTION_LABELS[key] || key || "—";
}
