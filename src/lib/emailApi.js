/**
 * קריאה ל-/api/send-email (Vercel + Resend).
 * מפתח API נשאר בשרת — לעולם לא ב-VITE_*.
 */

import { demoSendRealEmailEnabled } from "@/api/demoClient";

export function formatSendEmailError(data = {}, status) {
  if (data.message) return String(data.message);
  if (status === 503 && data.code === "email_not_configured") {
    return "שירות המייל לא מוגדר — הגדירו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel ועשו Redeploy";
  }
  if (status === 502) {
    return "שגיאת Resend (502) — בדקו ש-EMAIL_FROM מאומת בדומיין ב-Resend";
  }
  if (status === 429) {
    return data.message || "יותר מדי שליחות — נסו שוב בעוד שעה";
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
    };
  } catch {
    return { configured: false, apiPresent: false };
  }
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
    err.code = data.error || data.code || "send_failed";
    err.status = res.status;
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
