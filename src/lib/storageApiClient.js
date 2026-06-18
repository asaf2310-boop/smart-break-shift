import { supabase } from "@/api/supabase";
import { getGuestLinkToken } from "@/lib/guestLinkTokenStore";

const AGENT_AUTH_API = "/api/agent-auth";

async function authHeaders(requireBearer = false) {
  const headers = { "Content-Type": "application/json" };
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    } catch {
      /* ignore */
    }
  }
  if (requireBearer && !headers.Authorization) {
    return null;
  }
  return headers;
}

async function postStorageAction(body, { requireBearer = false, guestToken = null } = {}) {
  const headers = await authHeaders(requireBearer);
  if (!headers) {
    return { ok: false, error: "unauthorized", message: "נדרשת התחברות" };
  }

  const payload = guestToken ? { ...body, guestToken } : body;

  try {
    const response = await fetch(AGENT_AUTH_API, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: data.error || "request_failed",
        message: data.message || "הבקשה נכשלה",
      };
    }
    return { ok: true, ...data };
  } catch (err) {
    console.warn("[storageApiClient] request failed", err);
    return { ok: false, error: "network_error", message: "שגיאת רשת" };
  }
}

export async function uploadBlobToSignedUrl(signedUrl, blob, mimeType) {
  if (!signedUrl || !blob?.size) return { ok: false, error: "invalid_upload" };
  try {
    const response = await fetch(signedUrl, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": mimeType || "application/octet-stream" },
    });
    if (!response.ok) {
      return { ok: false, error: "upload_failed", message: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "upload_failed", message: err?.message || "העלאה נכשלה" };
  }
}

export async function apiPrepareSupportFileUpload({
  sessionId,
  storagePath,
  mimeType,
  uploadedBy = "agent",
  guestToken = null,
  fileBase64 = null,
}) {
  const token =
    guestToken || (uploadedBy === "guest" ? getGuestLinkToken(sessionId) : null);
  return postStorageAction(
    {
      action: "support_file_upload",
      sessionId,
      storagePath,
      mimeType,
      uploadedBy,
      ...(fileBase64 ? { fileBase64 } : {}),
    },
    { requireBearer: uploadedBy === "agent", guestToken: token }
  );
}

export async function apiGetSupportFileSignedUrl({
  sessionId,
  storagePath,
  bucket = "support-files",
  expiresIn,
  guestToken = null,
}) {
  const token = guestToken || getGuestLinkToken(sessionId);
  const requireBearer = bucket === "screen-recordings";
  return postStorageAction(
    {
      action: "support_file_signed_url",
      sessionId,
      storagePath,
      bucket,
      expiresIn,
    },
    { requireBearer, guestToken: requireBearer ? null : token }
  );
}

export async function apiPrepareRecordingUpload({ sessionId, storagePath, mimeType }) {
  return postStorageAction(
    {
      action: "recording_upload",
      sessionId,
      storagePath,
      mimeType,
    },
    { requireBearer: true }
  );
}
