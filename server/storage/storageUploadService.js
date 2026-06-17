import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";
import { verifyGuestLinkToken } from "../guest/guestLinkToken.js";
import { verifyBearerAgent } from "../agent/agentAuthService.js";

export const SUPPORT_FILES_BUCKET = "support-files";
export const SCREEN_RECORDINGS_BUCKET = "screen-recordings";

const SUPPORT_FILE_PATH_RE = /^[^/]+\/ss_file_[^/]+\.[^/]+$/;
const RECORDING_PATH_RE = /^[^/]+\/ss_rec[^/]+\.webm$/;

const MAX_DIRECT_UPLOAD_BYTES = 3_500_000;

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function sessionIdFromPath(storagePath) {
  return String(storagePath || "").split("/")[0] || "";
}

function isValidPath(bucket, storagePath) {
  if (!storagePath) return false;
  if (bucket === SUPPORT_FILES_BUCKET) return SUPPORT_FILE_PATH_RE.test(storagePath);
  if (bucket === SCREEN_RECORDINGS_BUCKET) return RECORDING_PATH_RE.test(storagePath);
  return false;
}

async function loadSupportSession(sessionId) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !sessionId) return null;

  const { data, error } = await supabase
    .from("support_sessions")
    .select("id, status, agent_name")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.warn("[storageUploadService] session load failed", error.message);
    return null;
  }
  return data;
}

/**
 * Authorize storage access for support-files (agent JWT or guest token) or
 * screen-recordings (agent JWT only).
 */
export async function authorizeStorageAccess({
  req,
  body = {},
  bucket,
  storagePath,
  sessionId,
  allowGuest = false,
}) {
  if (!isValidPath(bucket, storagePath)) {
    return { ok: false, error: "invalid_path" };
  }

  const pathSessionId = sessionIdFromPath(storagePath);
  const requestedSessionId = String(sessionId || pathSessionId).trim();
  if (!requestedSessionId || pathSessionId !== requestedSessionId) {
    return { ok: false, error: "session_mismatch" };
  }

  const session = await loadSupportSession(pathSessionId);
  if (!session) {
    return { ok: false, error: "not_found" };
  }
  if (session.status === "ended") {
    return { ok: false, error: "ended" };
  }

  const auth = await verifyBearerAgent(req);
  if (auth?.agent) {
    if (session.agent_name && auth.agent.displayName) {
      if (normalizeName(session.agent_name) !== normalizeName(auth.agent.displayName)) {
        return { ok: false, error: "forbidden" };
      }
    }
    return { ok: true, session, uploadedBy: "agent", agent: auth.agent };
  }

  if (allowGuest && bucket === SUPPORT_FILES_BUCKET) {
    const guestToken = String(body.guestToken || "").trim();
    if (!guestToken) {
      return { ok: false, error: "unauthorized" };
    }

    const verified = verifyGuestLinkToken(guestToken);
    if (!verified.ok) {
      return { ok: false, error: verified.error || "invalid_token" };
    }
    if (verified.sessionId !== pathSessionId) {
      return { ok: false, error: "session_mismatch" };
    }
    return { ok: true, session, uploadedBy: "guest" };
  }

  return { ok: false, error: "unauthorized" };
}

export async function uploadBufferToStorage({ bucket, storagePath, buffer, contentType }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    upsert: true,
    contentType: contentType || "application/octet-stream",
    cacheControl: "3600",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, storagePath };
}

export async function createSignedStorageUploadUrl({ bucket, storagePath }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

export async function createSignedStorageReadUrl({ bucket, storagePath, expiresIn = 3600 }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);
  if (error) return { ok: false, error: error.message };
  return { ok: true, signedUrl: data.signedUrl };
}

export async function handleSupportFileUpload(req, body) {
  const sessionId = String(body.sessionId || "").trim();
  const storagePath = String(body.storagePath || "").trim();
  const mimeType = String(body.mimeType || "application/octet-stream").trim();
  const fileBase64 = String(body.fileBase64 || "").trim();

  const authz = await authorizeStorageAccess({
    req,
    body,
    bucket: SUPPORT_FILES_BUCKET,
    storagePath,
    sessionId,
    allowGuest: true,
  });
  if (!authz.ok) return authz;

  if (fileBase64) {
    const buffer = Buffer.from(fileBase64, "base64");
    if (!buffer.length) {
      return { ok: false, error: "empty_file" };
    }
    if (buffer.length > MAX_DIRECT_UPLOAD_BYTES) {
      return { ok: false, error: "file_too_large", message: "הקובץ גדול מדי לשליחה ישירה — השתמשו ב-signedUrl" };
    }
    const uploaded = await uploadBufferToStorage({
      bucket: SUPPORT_FILES_BUCKET,
      storagePath,
      buffer,
      contentType: mimeType,
    });
    if (!uploaded.ok) return uploaded;
    return { ok: true, storagePath, uploadedBy: authz.uploadedBy };
  }

  const signed = await createSignedStorageUploadUrl({
    bucket: SUPPORT_FILES_BUCKET,
    storagePath,
  });
  if (!signed.ok) return signed;
  return {
    ok: true,
    storagePath,
    signedUrl: signed.signedUrl,
    token: signed.token,
    uploadedBy: authz.uploadedBy,
  };
}

export async function handleSupportFileSignedUrl(req, body) {
  const bucket = String(body.bucket || SUPPORT_FILES_BUCKET).trim();
  const storagePath = String(body.storagePath || "").trim();
  const sessionId = String(body.sessionId || "").trim();
  const expiresIn = Math.min(86400, Math.max(60, Number(body.expiresIn) || 3600));

  if (bucket !== SUPPORT_FILES_BUCKET && bucket !== SCREEN_RECORDINGS_BUCKET) {
    return { ok: false, error: "invalid_bucket" };
  }

  const authz = await authorizeStorageAccess({
    req,
    body,
    bucket,
    storagePath,
    sessionId,
    allowGuest: bucket === SUPPORT_FILES_BUCKET,
  });
  if (!authz.ok) return authz;

  const signed = await createSignedStorageReadUrl({ bucket, storagePath, expiresIn });
  if (!signed.ok) return signed;
  return { ok: true, signedUrl: signed.signedUrl, expiresIn };
}

export async function handleRecordingUpload(req, body) {
  const sessionId = String(body.sessionId || "").trim();
  const storagePath = String(body.storagePath || "").trim();
  const mimeType = String(body.mimeType || "video/webm").trim();
  const fileBase64 = String(body.fileBase64 || "").trim();

  const authz = await authorizeStorageAccess({
    req,
    body,
    bucket: SCREEN_RECORDINGS_BUCKET,
    storagePath,
    sessionId,
    allowGuest: false,
  });
  if (!authz.ok) return authz;

  if (fileBase64) {
    const buffer = Buffer.from(fileBase64, "base64");
    if (!buffer.length) {
      return { ok: false, error: "empty_file" };
    }
    if (buffer.length > MAX_DIRECT_UPLOAD_BYTES) {
      return { ok: false, error: "file_too_large", message: "הקובץ גדול מדי לשליחה ישירה — השתמשו ב-signedUrl" };
    }
    const uploaded = await uploadBufferToStorage({
      bucket: SCREEN_RECORDINGS_BUCKET,
      storagePath,
      buffer,
      contentType: mimeType,
    });
    if (!uploaded.ok) return uploaded;
    return { ok: true, storagePath };
  }

  const signed = await createSignedStorageUploadUrl({
    bucket: SCREEN_RECORDINGS_BUCKET,
    storagePath,
  });
  if (!signed.ok) return signed;
  return {
    ok: true,
    storagePath,
    signedUrl: signed.signedUrl,
    token: signed.token,
  };
}
