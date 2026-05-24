/** Vercel serverless — בדיקת הגדרת Resend (ללא חשיפת סודות) */

const DEMO_HOST_SUFFIXES = ["smart-break-shift-demo.vercel.app"];

function isDemoDeployment(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return DEMO_HOST_SUFFIXES.some((h) => host === h || host.endsWith(`.${h}`));
}

function parseFromDomain(from) {
  const match = String(from || "").match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : "";
}

function isSandboxFrom(from) {
  const lower = String(from || "").toLowerCase();
  return lower.includes("onboarding@resend.dev") || /@resend\.dev$/.test(lower);
}

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
  const fromDomain = parseFromDomain(from);
  const sandboxMode = configured && isSandboxFrom(from);
  const demoDeployment = isDemoDeployment(req);
  const rateLimitPerHour = demoDeployment ? 100 : 10;

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      configured,
      apiPresent: Boolean(apiKey),
      fromDomain: fromDomain || null,
      sandboxMode,
      demoDeployment,
      rateLimitPerHour,
      hint: !configured
        ? "הגדירו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel ועשו Redeploy"
        : sandboxMode
          ? "onboarding@resend.dev שולח רק למייל של חשבון Resend — ללקוחות אמתו דומיין והחליפו EMAIL_FROM"
          : "מוכן לשליחה לנמענים חיצוניים (דומיין מאומת)",
    })
  );
}
