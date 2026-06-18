/** Vercel serverless — שליחת SMS שיבוץ דרך Inforu (פרטי חשבון ב-process.env בלבד) */

import { verifyAdminAgent } from "../server/agent/agentAuthService.js";
import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import {
  checkRateLimit as checkRateLimitEntry,
  getRateLimitKey,
  rateLimitHebrewMessage,
  recordRateLimit,
  setRateLimitHeaders,
} from "../server/http/rateLimit.js";

const INFORU_SMS_URL = "https://api.inforu.co.il/SendMessageXml.ashx";
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateByKey = new Map();

const INFORU_STATUS_MESSAGES = {
  1: "נשלח בהצלחה",
  "-1": "שליחה נכשלה",
  "-2": "שם משתמש או טוקן שגויים",
  "-6": "חסרים נתוני נמענים",
  "-9": "חסר תוכן הודעה",
  "-11": "XML לא תקין",
  "-13": "חריגה ממכסת משתמש",
  "-18": "אין נמענים תקינים",
  "-20": "מספר שולח לא תקין",
  "-21": "שם שולח לא תקין",
  "-22": "משתמש חסום",
  "-26": "שגיאת אימות",
  "-90": "זיהוי שולח לא תקין",
  "-94": "שולח לא ברשימת המורשים",
};

function enforceSmsRateLimit(req, userId) {
  const key = getRateLimitKey(req, userId);
  const check = checkRateLimitEntry(rateByKey, key, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!check.allowed) {
    return { allowed: false, retryAfterSec: check.retryAfterSec };
  }
  recordRateLimit(check.entry);
  return { allowed: true };
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function normalizeIsraeliPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    digits = `0${digits}`;
  }
  if (!/^0\d{8,9}$/.test(digits)) return "";
  return digits;
}

export function buildInforuSmsXml({ userName, apiToken, message, phoneNumber, sender }) {
  return `<Inforu>
  <User>
    <Username>${escapeXml(userName)}</Username>
    <ApiToken>${escapeXml(apiToken)}</ApiToken>
  </User>
  <Content Type="sms">
    <Message>${escapeXml(message)}</Message>
  </Content>
  <Recipients>
    <PhoneNumber>${escapeXml(phoneNumber)}</PhoneNumber>
  </Recipients>
  <Settings>
    <Sender>${escapeXml(sender)}</Sender>
  </Settings>
</Inforu>`;
}

export function parseInforuResponse(body) {
  const text = String(body || "");
  const statusMatch = text.match(/<Status>\s*(-?\d+)\s*<\/Status>/i);
  const descriptionMatch = text.match(/<Description>\s*([^<]*)\s*<\/Description>/i);
  const status = statusMatch ? statusMatch[1] : null;
  const description = descriptionMatch ? descriptionMatch[1].trim() : "";
  const ok = status === "1";
  const message =
    description ||
    (status ? INFORU_STATUS_MESSAGES[status] || `Inforu status ${status}` : "תשובה לא מזוהה מ-Inforu");
  return { ok, status, message, raw: text.slice(0, 500) };
}

export async function sendInforuSms({ userName, apiToken, sender, to, message }) {
  const xml = buildInforuSmsXml({
    userName,
    apiToken,
    message,
    phoneNumber: to,
    sender,
  });
  const body = `InforuXML=${encodeURIComponent(xml)}`;
  const response = await fetch(INFORU_SMS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  const responseText = await response.text();
  const parsed = parseInforuResponse(responseText);
  if (!response.ok) {
    return {
      ok: false,
      message: parsed.message || `Inforu HTTP ${response.status}`,
      status: parsed.status,
      raw: parsed.raw,
    };
  }
  return parsed;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  const adminAuth = await verifyAdminAgent(req, {});
  if (!adminAuth?.agent) {
    return json(res, 403, { error: "forbidden", message: "נדרשת הרשאת מנהל" }, req);
  }

  const userName = String(process.env.INFORU_USERNAME || "").trim();
  const apiToken = String(process.env.INFORU_API_TOKEN || "").trim();
  const sender = String(process.env.INFORU_SENDER || "").trim();

  if (!userName || !apiToken || !sender) {
    return json(
      res,
      503,
      {
        code: "sms_not_configured",
        error: "שירות SMS לא מוגדר",
        message:
          "הגדירו INFORU_USERNAME, INFORU_API_TOKEN ו-INFORU_SENDER ב-Vercel (משתני שרת, ללא VITE_) ופרסמו מחדש.",
      },
      req
    );
  }

  const rate = enforceSmsRateLimit(req, adminAuth.agent.id);
  if (!rate.allowed) {
    const sec = setRateLimitHeaders(res, rate.retryAfterSec);
    return json(
      res,
      429,
      {
        error: "rate_limited",
        retryAfterSec: sec,
        message: rateLimitHebrewMessage(sec),
      },
      req
    );
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const phone = normalizeIsraeliPhone(payload.to);
  const message = String(payload.message || "").trim();
  const agentName = String(payload.agent_name || "").trim();

  if (!phone) {
    return json(res, 400, { error: "invalid_phone", message: "מספר טלפון לא תקין" }, req);
  }
  if (!message) {
    return json(res, 400, { error: "missing_message", message: "חסר תוכן הודעה" }, req);
  }

  try {
    const result = await sendInforuSms({
      userName,
      apiToken,
      sender,
      to: phone,
      message,
    });

    if (!result.ok) {
      return json(
        res,
        502,
        {
          error: "inforu_failed",
          message: result.message,
          inforuStatus: result.status ?? null,
        },
        req
      );
    }

    return json(
      res,
      200,
      {
        ok: true,
        to: phone,
        agent_name: agentName || null,
        message: result.message,
      },
      req
    );
  } catch (err) {
    console.error("[send-schedule-sms]", err);
    return json(
      res,
      502,
      {
        error: "sms_send_failed",
        message: err.message || "שליחת SMS נכשלה",
      },
      req
    );
  }
}
