/**
 * קריאה ל-/api/send-email (Vercel + Resend).
 * מפתח API נשאר בשרת — לעולם לא ב-VITE_*.
 */

import { demoSendRealEmailEnabled } from "@/api/demoClient";

function hebrewHintForResendMessage(message, resendStatus) {
  const m = String(message || "").toLowerCase();
  if (
    resendStatus === 403 ||
    m.includes("testing emails") ||
    m.includes("verify a domain") ||
    m.includes("resend.dev")
  ) {
    return " — עם onboarding@resend.dev אפשר לשלוח רק למייל של חשבון Resend. ללקוחות (למשל hyp.co.il) אמתו דומיין ב-Resend והגדירו EMAIL_FROM ממנו.";
  }
  if (resendStatus === 422 || m.includes("invalid") || m.includes("unprocessable")) {
    return " — כתובת הנמען נדחתה על ידי Resend (בדיקה/דומיין חסום).";
  }
  return "";
}

export function formatSendEmailError(data = {}, status) {
  if (data.code === "resend_sandbox_recipient") {
    return (
      "Resend במצב בדיקות (onboarding@resend.dev) — אפשר לשלוח רק למייל של חשבון Resend. " +
      "ללקוחות ב-Gmail או בדומיין הארגון: אמתו דומיין ב-resend.com/domains והגדירו EMAIL_FROM מהדומיין."
    );
  }
  if (data.message) {
    const base = String(data.message);
    return base + hebrewHintForResendMessage(base, data.resendStatus);
  }
  if (status === 503 && data.code === "email_not_configured") {
    return "שירות המייל לא מוגדר — הגדירו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel ועשו Redeploy";
  }
  if (status === 502) {
    return "שגיאת Resend — בדקו בלוח Resend → Emails / Domains: EMAIL_FROM מדומיין מאומת, והרשאות לנמען החיצוני";
  }
  if (status === 429) {
    const retryMin =
      data.retryAfterSec != null
        ? Math.max(1, Math.ceil(Number(data.retryAfterSec) / 60))
        : null;
    const suffix = retryMin ? ` — נסו שוב בעוד כ-${retryMin} דקות` : "";
    return (data.message || "יותר מדי שליחות מהשרת") + suffix;
  }
  if (status === 403) {
    return "גישה נדחתה — פתחו את האפליקציה מהדומיין הרשמי (CORS)";
  }
  if (status === 404) {
    return "שרת המייל לא נפרסם — העלו api/ ל-GitHub ו-Redeploy";
  }
  return data.error || `שליחת המייל נכשלה${status ? ` (${status})` : ""}`;
}

/** בדמו (ברירת מחדל שליחה אמיתית) — אל תיפלו לסימולציה בשקט */
export function rejectDemoRealEmailFallback(apiResult) {
  if (apiResult?.configured || !demoSendRealEmailEnabled) return;
  const err = new Error(
    apiResult.message ||
      "שירות המייל לא מוגדר — הוסיפו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel ועשו Redeploy"
  );
  err.code = apiResult.code || "email_not_configured";
  throw err;
}

export function logEmailDelivery(channel, mode, detail) {
  if (typeof console === "undefined") return;
  const label = `[${channel}] ${mode}`;
  if (detail != null && detail !== "") {
    console.info(label, detail);
  } else {
    console.info(label);
  }
}

export async function fetchEmailStatus() {
  try {
    const res = await fetch("/api/email-status");
    if (res.status === 404) {
      return { configured: false, apiPresent: false };
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      return { configured: false, apiPresent: true };
    }
    const hasExtendedFields =
      data.sandboxMode != null ||
      data.fromDomain != null ||
      data.rateLimitPerHour != null;
    return {
      configured: Boolean(data.configured),
      apiPresent: data.apiPresent !== false,
      fromDomain: data.fromDomain || null,
      sandboxMode: data.sandboxMode === true,
      demoDeployment: Boolean(data.demoDeployment),
      rateLimitPerHour: data.rateLimitPerHour ?? null,
      hint: data.hint || null,
      legacyStatusOnly: Boolean(data.configured) && !hasExtendedFields,
    };
  } catch {
    return { configured: false, apiPresent: false };
  }
}

/** טקסט אבחון בעברית לכפתור «בדיקת מייל» (buildFlags מהדפדפן בלבד) */
export function formatEmailDiagnosticReport(status, buildFlags = {}) {
  const lines = [];
  const actions = [];

  if (!status?.apiPresent) {
    lines.push("── שרת (Vercel) ──");
    lines.push("שרת API: לא נפרס");
    actions.push("העלו תיקיית api/ ל-GitHub ועשו Redeploy");
    actions.push("מקומית: vercel dev (לא npm run dev בלבד)");
  } else {
    lines.push("── שרת (Vercel) ──");
    lines.push("שרת API: פעיל");
    lines.push(`Resend (RESEND_API_KEY + EMAIL_FROM): ${status.configured ? "מוגדר" : "חסר"}`);

    if (status.legacyStatusOnly) {
      lines.push(
        "אבחון מורחב: לא זמין בפריסה הנוכחית — Redeploy כדי לראות sandbox / דומיין / מגבלה"
      );
      if (status.configured) {
        actions.push(
          "Redeploy — אחר כך «בדיקת מייל» יראה אם EMAIL_FROM הוא resend.dev (מצב בדיקות)"
        );
      }
    } else if (status.fromDomain) {
      lines.push(`דומיין שולח (EMAIL_FROM): ${status.fromDomain}`);
    }

    if (status.sandboxMode) {
      lines.push(
        "מצב Resend: בדיקות (onboarding@resend.dev) — שליחה רק למייל של חשבון Resend"
      );
      actions.push(
        "אמתו דומיין ב-resend.com/domains והגדירו EMAIL_FROM מהדומיין (לא resend.dev) — Redeploy"
      );
    } else if (status.configured && !status.legacyStatusOnly) {
      lines.push("מצב Resend: דומיין מאומת — נמענים חיצוניים (Gmail, דומיין ארגון) מותרים");
    }

    if (status.rateLimitPerHour) {
      lines.push(`מגבלת שליחה: ${status.rateLimitPerHour} מיילים לשעה ל-IP`);
    } else if (status.demoDeployment) {
      lines.push("מגבלת שליחה: 100/שעה (דמו) — אחרי Redeploy של API");
    }

    if (!status.configured) {
      actions.push("ב-Vercel: RESEND_API_KEY + EMAIL_FROM (בלי VITE_) — Redeploy");
    }
    if (status.hint) {
      lines.push(`הערת שרת: ${status.hint}`);
    }
  }

  lines.push("── בנייה (דפדפן, VITE_* בזמן Deploy) ──");
  if (!buildFlags.demoModeEnabled) {
    lines.push("VITE_DEMO_MODE: כבוי — אין סימולציית דמו; שליחה תמיד דרך /api/send-email");
  } else {
    lines.push("VITE_DEMO_MODE: מופעל (אתר דמו)");
    lines.push(`VITE_DEMO_SEND_REAL_EMAIL: ${buildFlags.viteSendRaw || "(לא ידוע)"}`);
    if (buildFlags.attemptsRealEmailInDemo) {
      lines.push("שליחה אמיתית בדמו: מופעלת (ברירת מחדל — רק false מכבה)");
    } else {
      lines.push("שליחה אמיתית בדמו: כבויה במפורש (false ב-build)");
      actions.push(
        "מחקו VITE_DEMO_SEND_REAL_EMAIL=false מ-Vercel (או הגדירו true) — Redeploy חובה"
      );
    }
  }

  if (actions.length) {
    lines.push("── מה לעשות ──");
    actions.forEach((text, i) => lines.push(`${i + 1}. ${text}`));
  }

  return lines.join("\n");
}

export async function postSendEmail({ to, subject, html, text }) {
  let res;
  try {
    res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, text }),
    });
  } catch {
    const err = new Error("לא ניתן להתחבר לשרת המייל — בדקו חיבור או השתמשו ב-mailto");
    err.code = "network";
    throw err;
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 404) {
    return {
      configured: false,
      apiPresent: false,
      message: "שרת המייל לא נפרסם — העלו את תיקיית api/ ל-GitHub ו-Redeploy",
    };
  }

  if (res.status === 503 && data.code === "email_not_configured") {
    return { configured: false, apiPresent: true, ...data };
  }

  if (!res.ok) {
    const err = new Error(formatSendEmailError(data, res.status));
    err.code = data.code || data.error || "send_failed";
    err.status = res.status;
    err.limit = data.limit;
    err.retryAfterSec = data.retryAfterSec;
    err.resendStatus = data.resendStatus;
    err.resendMessage = data.message;
    throw err;
  }

  return { configured: true, ok: true, id: data.id || null };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
