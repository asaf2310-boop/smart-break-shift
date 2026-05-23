/**
 * קריאה ל-/api/send-email (Vercel + Resend).
 * מפתח API נשאר בשרת — לעולם לא ב-VITE_*.
 */

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
