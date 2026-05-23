/** Vercel serverless — בדיקת הגדרת Resend (ללא חשיפת סודות) */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = String(process.env.EMAIL_FROM || "").trim();
  const configured = Boolean(apiKey && from);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ configured, apiPresent: Boolean(apiKey) }));
}
