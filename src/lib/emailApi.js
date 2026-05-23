/**
 * קריאה ל-/api/send-email (Vercel + Resend).
 * מפתח API נשאר בשרת — לעולם לא ב-VITE_*.
 */

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
    const err = new Error(data.message || data.error || "שליחת המייל נכשלה");
    err.code = data.error || "send_failed";
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
