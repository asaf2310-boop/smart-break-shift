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

/** בדמו עם VITE_DEMO_SEND_REAL_EMAIL — אל תיפלו לסימולציה בשקט */
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
    return {
      configured: Boolean(data.configured),
      apiPresent: data.apiPresent !== false,
      fromDomain: data.fromDomain || null,
      sandboxMode: Boolean(data.sandboxMode),
      demoDeployment: Boolean(data.demoDeployment),
      rateLimitPerHour: data.rateLimitPerHour ?? null,
      hint: data.hint || null,
    };
  } catch {
    return { configured: false, apiPresent: false };
  }
}

/** טקסט אבחון בעברית לכפתור «בדיקת מייל» */
export function formatEmailDiagnosticReport(status, { demoSendRealEmail } = {}) {
  const lines = [];
  if (!status?.apiPresent) {
    lines.push("שרת API: לא נפרס (העלו api/ ו-Redeploy)");
    return lines.join("\n");
  }
  lines.push(`שרת API: פעיל`);
  lines.push(`Resend מוגדר: ${status.configured ? "כן" : "לא"}`);
  if (status.fromDomain) {
    lines.push(`דומיין שולח (EMAIL_FROM): ${status.fromDomain}`);
  }
  if (status.sandboxMode) {
    lines.push(
      "מצב בדיקות Resend: onboarding@resend.dev — שליחה רק למייל של חשבון Resend, לא ללקוחות"
    );
  } else if (status.configured) {
    lines.push("מצב שליחה: דומיין מאומת (נמענים חיצוניים מותרים)");
  }
  if (status.rateLimitPerHour) {
    lines.push(`מגבלת שליחה: ${status.rateLimitPerHour} מיילים לשעה ל-IP`);
  }
  if (demoSendRealEmail != null) {
    lines.push(
      `בניית דמו (VITE_DEMO_SEND_REAL_EMAIL): ${demoSendRealEmail ? "מייל אמיתי" : "סימולציה בלבד"}`
    );
  }
  if (status.hint) {
    lines.push(`המלצה: ${status.hint}`);
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
      message: "שרת המייל לא נפרסם — העלו את תיקיית api/ ל-GitHub ו-Redeploy",
    };
  }

  if (res.status === 503 && data.code === "email_not_configured") {
    return { configured: false, ...data };
  }

  if (!res.ok) {
    const err = new Error(formatSendEmailError(data, res.status));
    err.code = data.code || data.error || "send_failed";
    err.status = res.status;
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
