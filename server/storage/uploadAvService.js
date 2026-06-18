import crypto from "crypto";

const AV_SCAN_TIMEOUT_MS = 25_000;

export function isProductionUploadEnv() {
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

/** Default: block ZIP in production unless AV webhook is configured. */
export function zipUploadAllowedWithoutAv() {
  const raw = String(process.env.SUPPORT_ZIP_ALLOW_WITHOUT_AV ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return !isProductionUploadEnv();
}

export function isAvWebhookConfigured() {
  return Boolean(String(process.env.UPLOAD_AV_WEBHOOK_URL || "").trim());
}

/**
 * Best-effort external AV scan (ClamAV gateway, etc.).
 * Webhook should accept POST JSON: { sha256, fileName, mimeType, size, bufferBase64 }
 * and respond { ok: true } or { clean: true } on pass; { ok: false, reason } on fail.
 */
export async function scanUploadBufferWithAv({ buffer, fileName, mimeType }) {
  const url = String(process.env.UPLOAD_AV_WEBHOOK_URL || "").trim();
  if (!url) {
    return { ok: true, skipped: true };
  }
  if (!buffer?.length) {
    return { ok: false, error: "empty_file", message: "קובץ ריק" };
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AV_SCAN_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha256,
        fileName: String(fileName || "").slice(0, 255),
        mimeType: String(mimeType || "application/octet-stream"),
        size: buffer.length,
        bufferBase64: buffer.toString("base64"),
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: "av_scan_failed",
        message: data.message || data.reason || "סריקת אנטי-וירוס נכשלה",
      };
    }
    const clean = data.ok === true || data.clean === true || data.safe === true;
    if (!clean) {
      return {
        ok: false,
        error: "av_detected_threat",
        message: data.message || "הקובץ נחסם על ידי סריקת אבטחה",
      };
    }
    return { ok: true, sha256 };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "av_scan_timeout" : "av_scan_error",
      message: aborted ? "סריקת אנטי-וירוס ארכה זמן רב מדי" : "לא ניתן להשלים סריקת אבטחה",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function assertZipUploadPolicy() {
  if (zipUploadAllowedWithoutAv() || isAvWebhookConfigured()) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "zip_av_required",
    message:
      "העלאת ZIP חסומה בפרודקשן עד להגדרת UPLOAD_AV_WEBHOOK_URL (או SUPPORT_ZIP_ALLOW_WITHOUT_AV=true לסיכון מודע)",
  };
}
