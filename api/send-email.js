/** Vercel serverless — שליחת מייל דרך Resend (מפתח ב-process.env בלבד) */

const RESEND_URL = "https://api.resend.com/emails";
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateByIp = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateByIp.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateByIp.set(ip, entry);
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

function getSiteOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || Array.isArray(host)) return null;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    (typeof protoHeader === "string" ? protoHeader.split(",")[0] : null) ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function isSameOrigin(req) {
  const siteOrigin = getSiteOrigin(req);
  if (!siteOrigin) return false;
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin === siteOrigin) return true;
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.startsWith(siteOrigin)) return true;
  return false;
}

function corsHeaders(req) {
  const siteOrigin = getSiteOrigin(req);
  const origin = req.headers.origin;
  if (siteOrigin && typeof origin === "string" && origin === siteOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return { Vary: "Origin" };
}

function json(res, status, body, req) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    if (!isSameOrigin(req)) {
      return json(res, 403, { error: "forbidden" }, req);
    }
    res.statusCode = 204;
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !from) {
    return json(
      res,
      503,
      {
        code: "email_not_configured",
        error: "שירות המייל לא מוגדר",
        message:
          "הגדירו RESEND_API_KEY ו-EMAIL_FROM ב-Vercel (או .env.local עם vercel dev) ופרסמו מחדש.",
      },
      req
    );
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return json(
      res,
      429,
      {
        error: "rate_limited",
        message: "יותר מדי בקשות שליחה — נסו שוב בעוד שעה",
      },
      req
    );
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const html = String(body.html || "").trim();
  const text = body.text != null ? String(body.text).trim() : undefined;

  if (!isValidEmail(to)) {
    return json(res, 400, { error: "invalid_email", message: "כתובת מייל לא תקינה" }, req);
  }
  if (!subject || subject.length > 500) {
    return json(res, 400, { error: "invalid_subject" }, req);
  }
  if (!html && !text) {
    return json(res, 400, { error: "missing_body" }, req);
  }

  const payload = {
    from,
    to: [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };

  try {
    const resendRes = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      const message =
        data?.message || data?.error || `Resend error (${resendRes.status})`;
      return json(res, 502, { error: "send_failed", message }, req);
    }
    return json(res, 200, { ok: true, id: data.id || null }, req);
  } catch (err) {
    return json(
      res,
      502,
      {
        error: "send_failed",
        message: err?.message || "שגיאת רשת בשליחת המייל",
      },
      req
    );
  }
}
