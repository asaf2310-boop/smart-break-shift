/** קודי סיבה לסימולציית מייל — נשמרים ב-email log לבאנר SessionEmailStatus */

export function isLocalViteDev() {
  if (typeof window === "undefined") return import.meta.env.DEV;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function simulatedReasonForDemoSendDisabled() {
  return {
    simulatedReason: "demo_send_disabled",
    simulatedReasonHint:
      "שליחה אמיתית כבויה ב-build (VITE_DEMO_SEND_REAL_EMAIL=false). להפעלה: הסירו את המשתנה או הגדירו true ב-Vercel Production — ואז Redeploy.",
  };
}

export function simulatedReasonForApiResult(apiResult) {
  if (apiResult?.apiPresent === false) {
    return {
      simulatedReason: "api_not_deployed",
      simulatedReasonHint:
        "אין שרת /api בפריסה — ודאו שתיקיית api/ ב-GitHub, Redeploy, או מקומית: vercel dev (לא npm run dev בלבד).",
    };
  }
  if (isLocalViteDev()) {
    return {
      simulatedReason: "local_no_api",
      simulatedReasonHint:
        "רצים על localhost — npm run dev לא מגיש /api/send-email. השתמשו ב-vercel dev עם .env.local, או בדקו בכתובת Vercel אחרי Redeploy.",
    };
  }
  return {
    simulatedReason: "resend_not_configured",
    simulatedReasonHint:
      apiResult?.message ||
      "Resend לא מוגדר בשרת — הוסיפו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel (Production) ועשו Redeploy. משתנים ב-upload script לא מספיקים.",
  };
}

export function getSimulatedStatusHint(log) {
  if (!log || log.status !== "simulated") return null;
  if (log.simulatedReasonHint) return log.simulatedReasonHint;
  const defaults = {
    demo_send_disabled:
      "שליחה אמיתית כבויה ב-build — VITE_DEMO_SEND_REAL_EMAIL=false ב-Vercel; Redeploy אחרי שינוי.",
    demo_build_flag:
      "ב-build חסר אישור לשליחה אמיתית בדמו — Redeploy עם VITE_DEMO_MODE=true (ברירת מחדל: שליחה אמיתית).",
    api_not_deployed: "שרת המייל לא נפרס — api/ + Redeploy.",
    local_no_api: "localhost ללא vercel dev — אין /api.",
    resend_not_configured: "RESEND_API_KEY / EMAIL_FROM חסרים ב-Vercel.",
  };
  return defaults[log.simulatedReason] || "המייל לא נשלח — העתיקו את הקישור או השתמשו ב-mailto.";
}
