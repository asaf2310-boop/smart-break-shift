import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import {
  REVIEW_SMS_URL_MAX_LENGTH,
  resolveReviewSmsUrlFromSources,
  validateGoogleReviewSmsUrl,
} from "./reviewLink.js";

export const APP_SETTING_GOOGLE_REVIEW_SMS_URL = "google_review_sms_url";

export async function getStoredGoogleReviewSmsUrl() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", APP_SETTING_GOOGLE_REVIEW_SMS_URL)
    .maybeSingle();

  if (error) {
    console.warn("[reviewSmsSettings] read", error.message);
    return null;
  }

  const value = String(data?.value || "").trim();
  return value || null;
}

export async function setStoredGoogleReviewSmsUrl(url, actorAgentId = null) {
  const validation = validateGoogleReviewSmsUrl(url);
  if (!validation.ok) {
    return validation;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "not_configured",
      message: "מסד הנתונים לא מוגדר. בדקו SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const row = {
    key: APP_SETTING_GOOGLE_REVIEW_SMS_URL,
    value: validation.url,
    updated_at: new Date().toISOString(),
    updated_by: actorAgentId || null,
  };

  const { error } = await supabase.from("app_settings").upsert(row, { onConflict: "key" });
  if (error) {
    console.error("[reviewSmsSettings] write", error.message);
    return {
      ok: false,
      error: "save_failed",
      message: "לא הצלחנו לשמור את הקישור. ודאו שהרצתם את app_settings_review_url.sql ב-Supabase.",
    };
  }

  return { ok: true, url: validation.url };
}

export async function resolveReviewSmsUrl() {
  const dbUrl = await getStoredGoogleReviewSmsUrl();
  return resolveReviewSmsUrlFromSources({ dbSmsUrl: dbUrl });
}

export async function getReviewSmsSettingsPayload() {
  const dbUrl = await getStoredGoogleReviewSmsUrl();
  const resolved = resolveReviewSmsUrlFromSources({ dbSmsUrl: dbUrl });

  return {
    ok: resolved.ok,
    smsUrl: resolved.ok ? resolved.url : null,
    source: resolved.source || null,
    dbUrl: dbUrl || null,
    error: resolved.error || null,
    message: resolved.message || null,
  };
}

export function maskReviewSmsUrl(url, { head = 28, tail = 12 } = {}) {
  const text = String(url || "").trim();
  if (!text) return "";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}
