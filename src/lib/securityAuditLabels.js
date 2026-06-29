/** Hebrew labels for security_audit_log.action values (phase 12–20). */

export const SECURITY_AUDIT_ACTION_LABELS = {
  admin_set_password: "הגדרת סיסמה (מנהל)",
  admin_create_break_registration: "יצירת הרשמת הפסקה",
  admin_delete_break_registration: "מחיקת הרשמת הפסקה",
  admin_agent_create: "יצירת נציג",
  admin_agent_update: "עדכון נציג",
  admin_agent_modules: "עדכון מודולים לנציג",
  admin_agent_block: "חסימת נציג",
  admin_agent_unblock: "ביטול חסימת נציג",
  admin_agent_delete: "מחיקת נציג (רך)",
  crm_routing_change: "שינוי כללי ניתוב CRM",
  provision_auth: "הקמת משתמש Auth לנציג",
  guest_link_mint: "יצירת קישור אורח",
  guest_link_created: "יצירת קישור אורח",
  guest_link_redeemed: "מימוש קישור אורח",
  remote_session_start: "תחילת חיבור WebRTC (תמיכה מרחוק)",
  remote_session_end: "סיום חיבור WebRTC (תמיכה מרחוק)",
  support_session_end: "סיום סשן תמיכה",
  knowledge_upload: "העלאת מסמך ידע",
  knowledge_delete: "מחיקת מסמך ידע",
  knowledge_gap_update: "עדכון פער ידע",
  send_review_sms: "שליחת SMS דירוג גוגל",
  send_wealthy_guide_sms: "שליחת SMS מדריך תשלומים",
  send_schedule_sms: "שליחת SMS שיבוץ",
  sip_token_mint: "הנפקת טוקן SIP",
  sip_token_redeem: "מימוש טוקן SIP",
  update_review_sms_settings: "עדכון קישור דירוג SMS",
};

export function securityAuditActionLabel(action) {
  const key = String(action || "").trim();
  return SECURITY_AUDIT_ACTION_LABELS[key] || key || "—";
}
