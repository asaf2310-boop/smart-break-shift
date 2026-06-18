import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import {
  resolveReviewSmsUrlFromSources,
  shouldAutoShortenReviewUrl,
  validateGoogleReviewSmsUrl,
} from "./reviewLink.js";
import { shortenUrlForSms } from "./urlShortener.js";

export const APP_SETTING_GOOGLE_REVIEW_SMS_URL = "google_review_sms_url";
export const APP_SETTING_GOOGLE_REVIEW_TARGET_URL = "google_review_target_url";

const APP_SETTINGS_SQL_HINT =
  "הריצו את supabase/app_settings_review_url.sql ב-Supabase SQL Editor (פעם אחת).";

function isAppSettingsTableMissing(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "42P01" ||
    (msg.includes("app_settings") &&
      (msg.includes("does not exist") || msg.includes("not exist") || msg.includes("לא קיים"))) ||
    (msg.includes("relation") && msg.includes("app_settings"))
  );
}

function emptyStoredUrls(dbError = null, dbErrorMessage = null) {
  return {
    smsUrl: null,
    targetUrl: null,
    dbError,
    dbErrorMessage,
  };
}

/** @returns {{ smsUrl: string|null, targetUrl: string|null, dbError: string|null, dbErrorMessage: string|null }} */
export async function getStoredGoogleReviewUrls() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return emptyStoredUrls(
      "not_configured",
      "מסד הנתונים לא מוגדר בשרת. בדקו SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [APP_SETTING_GOOGLE_REVIEW_SMS_URL, APP_SETTING_GOOGLE_REVIEW_TARGET_URL]);

  if (error) {
    console.warn("[reviewSmsSettings] read", error.message);
    if (isAppSettingsTableMissing(error)) {
      return emptyStoredUrls(
        "app_settings_missing",
        `טבלת הגדרות לא קיימת במסד. ${APP_SETTINGS_SQL_HINT}`
      );
    }
    return emptyStoredUrls(
      "read_failed",
      "לא הצלחנו לקרוא הגדרות מהמסד. בדקו SUPABASE_SERVICE_ROLE_KEY בשרת."
    );
  }

  const byKey = Object.fromEntries((data || []).map((row) => [row.key, String(row.value || "").trim()]));
  const smsUrl = byKey[APP_SETTING_GOOGLE_REVIEW_SMS_URL] || null;
  const targetUrl = byKey[APP_SETTING_GOOGLE_REVIEW_TARGET_URL] || smsUrl || null;

  return { smsUrl, targetUrl, dbError: null, dbErrorMessage: null };
}

/** @deprecated Use getStoredGoogleReviewUrls */
export async function getStoredGoogleReviewSmsUrl() {
  const stored = await getStoredGoogleReviewUrls();
  return {
    url: stored.smsUrl,
    dbError: stored.dbError,
    dbErrorMessage: stored.dbErrorMessage,
  };
}

async function upsertAppSettings(rows) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "not_configured",
      message: "מסד הנתונים לא מוגדר. בדקו SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) {
    console.error("[reviewSmsSettings] write", error.message);
    return {
      ok: false,
      error: "save_failed",
      message: "לא הצלחנו לשמור את הקישור. ודאו שהרצתם את app_settings_review_url.sql ב-Supabase.",
    };
  }

  return { ok: true };
}

export async function setStoredGoogleReviewSmsUrl(url, actorAgentId = null) {
  const decision = shouldAutoShortenReviewUrl(url);
  if (!decision.shorten && decision.validation && !decision.validation.ok) {
    return decision.validation;
  }

  let smsUrl = decision.smsUrl || null;
  let targetUrl = decision.targetUrl || null;
  let shortened = false;
  let shortenProvider = null;

  if (decision.shorten) {
    const shortenedResult = await shortenUrlForSms(decision.targetUrl);
    if (!shortenedResult.ok) {
      return shortenedResult;
    }

    const smsValidation = validateGoogleReviewSmsUrl(shortenedResult.url);
    if (!smsValidation.ok) {
      return {
        ok: false,
        error: "short_url_invalid",
        message: smsValidation.message || "הקישור המקוצר אינו תקין ל-SMS",
      };
    }

    smsUrl = smsValidation.url;
    targetUrl = decision.targetUrl;
    shortened = true;
    shortenProvider = shortenedResult.provider;
  }

  const updatedAt = new Date().toISOString();
  const rows = [
    {
      key: APP_SETTING_GOOGLE_REVIEW_SMS_URL,
      value: smsUrl,
      updated_at: updatedAt,
      updated_by: actorAgentId || null,
    },
    {
      key: APP_SETTING_GOOGLE_REVIEW_TARGET_URL,
      value: targetUrl,
      updated_at: updatedAt,
      updated_by: actorAgentId || null,
    },
  ];

  const saved = await upsertAppSettings(rows);
  if (!saved.ok) {
    return saved;
  }

  return {
    ok: true,
    url: smsUrl,
    smsUrl,
    targetUrl,
    shortened,
    shortenProvider,
    message: shortened
      ? `הקישור קוצר אוטומטית (${shortenProvider}) לשליחה ב-SMS`
      : "קישור דירוג נשמר בהצלחה",
  };
}

export async function resolveReviewSmsUrl() {
  const stored = await getStoredGoogleReviewUrls();
  return resolveReviewSmsUrlFromSources({ dbSmsUrl: stored.smsUrl });
}

export async function getReviewSmsSettingsPayload() {
  const stored = await getStoredGoogleReviewUrls();
  const resolved = resolveReviewSmsUrlFromSources({ dbSmsUrl: stored.smsUrl });

  let message = resolved.message || null;
  if (!resolved.ok && stored.dbError === "app_settings_missing" && !stored.smsUrl) {
    message = stored.dbErrorMessage;
  } else if (
    !resolved.ok &&
    stored.dbErrorMessage &&
    !stored.smsUrl &&
    resolved.error === "review_sms_url_not_configured"
  ) {
    message = `${resolved.message || ""} ${stored.dbErrorMessage}`.trim();
  }

  return {
    ok: resolved.ok,
    smsUrl: resolved.ok ? resolved.url : null,
    source: resolved.source || null,
    dbUrl: stored.smsUrl || null,
    dbTargetUrl: stored.targetUrl || null,
    dbError: stored.dbError || null,
    dbErrorMessage: stored.dbErrorMessage || null,
    error: resolved.error || stored.dbError || null,
    message,
  };
}

export function maskReviewSmsUrl(url, { head = 28, tail = 12 } = {}) {
  const text = String(url || "").trim();
  if (!text) return "";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}
