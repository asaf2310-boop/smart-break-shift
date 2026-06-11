/** Vercel serverless — בדיקת הגדרת Inforu SMS (ללא חשיפת סודות) */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const userName = String(process.env.INFORU_USERNAME || "").trim();
  const apiToken = String(process.env.INFORU_API_TOKEN || "").trim();
  const sender = String(process.env.INFORU_SENDER || "").trim();
  const configured = Boolean(userName && apiToken && sender);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      configured,
      hasUsername: Boolean(userName),
      hasApiToken: Boolean(apiToken),
      hasSender: Boolean(sender),
      senderPreview: sender ? sender.slice(0, 4) : null,
      hint: !configured
        ? "הגדירו INFORU_USERNAME, INFORU_API_TOKEN, INFORU_SENDER ב-Vercel ו-VITE_SCHEDULE_SMS_WEBHOOK=/api/send-schedule-sms"
        : "מוכן לשליחה דרך POST /api/send-schedule-sms",
    })
  );
}
