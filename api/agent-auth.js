/** Vercel serverless — agent auth, guest links, storage uploads (phase 5). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import {
  checkIpRateLimit,
  getClientIp,
  recordIpRateLimit,
} from "../server/http/rateLimit.js";
import {
  handleRecordingUpload,
  handleSupportFileSignedUrl,
  handleSupportFileUpload,
} from "../server/storage/storageUploadService.js";
import {
  adminUpdateAgentPassword,
  getAgentById,
  markAgentPasswordSetupComplete,
  markAgentNeedsPasswordSetup,
  provisionAuthUserForAgent,
  verifyAdminAgent,
  verifyBearerAgent,
} from "../server/agent/agentAuthService.js";
import {
  adminCreateBreakRegistration,
  adminDeleteBreakRegistration,
} from "../server/agent/breakRegistrationAdminService.js";
import { requestPasswordResetByEmail, requestFirstLoginByEmail } from "../server/agent/agentPasswordResetService.js";
import {
  guestLinkApiReady,
  mintGuestLinkForSession,
  resolveGuestLinkFromToken,
} from "../server/guest/guestLinkService.js";
import {
  auditGuestAccess,
  fetchGuestSessionState,
  insertGuestSessionChatMessage,
  listGuestSessionChatMessages,
} from "../server/guest/guestSupportService.js";
import { verifyGuestLinkToken } from "../server/guest/guestLinkToken.js";
import { handleIceServersRequest, DEFAULT_STUN_SERVERS } from "../server/webrtc/iceServersService.js";

const PASSWORD_MIN_LENGTH = 12;

const guestResolveRateByIp = new Map();
const guestSessionRateByIp = new Map();
const guestChatRateByIp = new Map();

const GUEST_RESOLVE_RATE_MAX = 60;
const GUEST_SESSION_POLL_RATE_MAX = 240;
const GUEST_CHAT_RATE_MAX = 120;
const ICE_SERVERS_RATE_MAX = 120;

function rateLimitResponse(res, req, retryAfterSec) {
  return json(
    res,
    429,
    {
      error: "rate_limited",
      retryAfterSec,
      message: `יותר מדי בקשות — נסו שוב בעוד ${retryAfterSec} שניות`,
    },
    req
  );
}

function enforceIpRateLimit(res, req, store, max) {
  const ip = getClientIp(req);
  const check = checkIpRateLimit(store, ip, max);
  if (!check.allowed) {
    rateLimitResponse(res, req, check.retryAfterSec);
    return false;
  }
  recordIpRateLimit(check.entry);
  return true;
}

async function requireAdminAgent(req, res, body) {
  const auth = await verifyAdminAgent(req, body);
  if (!auth?.agent) {
    json(res, 403, { error: "forbidden", message: "נדרשת הרשאת מנהל" }, req);
    return null;
  }
  return auth;
}

function supabaseReady() {
  return isPgVectorConfigured();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const action = String(body.action || "").trim();

  if (action === "ice_servers") {
    if (!enforceIpRateLimit(res, req, guestResolveRateByIp, ICE_SERVERS_RATE_MAX)) return;

    const guestToken = String(body.guestToken || "").trim();
    let authorized = false;
    if (guestToken) {
      const verified = verifyGuestLinkToken(guestToken);
      authorized = verified.ok;
    } else {
      const auth = await verifyBearerAgent(req);
      authorized = Boolean(auth?.agent);
    }

    if (!authorized) {
      return json(
        res,
        200,
        {
          ok: true,
          iceServers: DEFAULT_STUN_SERVERS,
          iceTransportPolicy: "all",
          turnConfigured: false,
        },
        req
      );
    }

    return handleIceServersRequest(res, req);
  }

  if (!supabaseReady()) {
    return json(
      res,
      503,
      {
        error: "supabase_not_configured",
        message: "הגדר VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ב-Vercel",
      },
      req
    );
  }

  if (action === "complete_setup") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות" }, req);
    }

    try {
      await markAgentPasswordSetupComplete(auth.agent.id);
      return json(res, 200, { ok: true, authUserId: auth.authUser.id }, req);
    } catch (err) {
      console.error("[agent-auth] complete_setup", err);
      return json(res, 500, { error: "update_failed", message: "לא הצלחנו לעדכן" }, req);
    }
  }

  if (action === "sync_auth") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות" }, req);
    }
    return json(res, 200, { ok: true, authUserId: auth.authUser.id }, req);
  }

  if (action === "request_password_reset") {
    const email = String(body.email || "").trim();
    try {
      const result = await requestPasswordResetByEmail(email);
      const status = result.ok ? 200 : 400;
      return json(res, status, result, req);
    } catch (err) {
      console.error("[agent-auth] request_password_reset", err);
      return json(
        res,
        500,
        { ok: false, message: "לא הצלחנו לעבד את הבקשה" },
        req
      );
    }
  }

  if (action === "request_first_login") {
    const email = String(body.email || "").trim();
    try {
      const result = await requestFirstLoginByEmail(email);
      const status = result.ok ? 200 : 400;
      return json(res, status, result, req);
    } catch (err) {
      console.error("[agent-auth] request_first_login", err);
      return json(res, 500, { ok: false, message: "לא הצלחנו לעבד את הבקשה" }, req);
    }
  }

  if (action === "admin_set_password") {
    if (!(await requireAdminAgent(req, res, body))) return;

    const agentId = String(body.agentId || body.id || "").trim();
    const password = String(body.password || "");
    const forceSetup = body.forceSetup !== false;

    if (!agentId || password.length < PASSWORD_MIN_LENGTH) {
      return json(
        res,
        400,
        { error: "invalid_fields", message: "סיסמה חייבת להכיל לפחות 12 תווים" },
        req
      );
    }

    try {
      const agent = await getAgentById(agentId);
      if (!agent) {
        return json(res, 404, { error: "not_found", message: "נציג לא נמצא" }, req);
      }

      const provisioned = await provisionAuthUserForAgent(agent, password);
      await adminUpdateAgentPassword(provisioned.authUserId, password);

      if (forceSetup) {
        await markAgentNeedsPasswordSetup(agentId);
      } else {
        await markAgentPasswordSetupComplete(agentId);
      }

      return json(res, 200, { ok: true, authUserId: provisioned.authUserId }, req);
    } catch (err) {
      console.error("[agent-auth] admin_set_password", err);
      return json(
        res,
        500,
        { error: "password_update_failed", message: "לא הצלחנו לעדכן סיסמה" },
        req
      );
    }
  }

  if (action === "admin_create_break_registration") {
    if (!(await requireAdminAgent(req, res, body))) return;

    const agent_name = String(body.agent_name || "").trim();
    const break_type = String(body.break_type || "").trim();
    const time_slot = String(body.time_slot || "").trim();
    const date = String(body.date || "").trim();

    if (!agent_name || !break_type || !time_slot || !date) {
      return json(
        res,
        400,
        { error: "invalid_fields", message: "חסרים שדות חובה להרשמה" },
        req
      );
    }

    try {
      const registration = await adminCreateBreakRegistration({
        agent_name,
        break_type,
        time_slot,
        date,
      });
      return json(res, 200, { ok: true, registration }, req);
    } catch (err) {
      console.error("[agent-auth] admin_create_break_registration", err);
      const message =
        err?.code === "insert_rejected"
          ? err.message
          : String(err?.message || "") === "invalid_fields"
            ? "חסרים שדות חובה להרשמה"
            : "לא הצלחנו לשמור את ההרשמה";
      return json(res, 500, { error: "create_failed", message }, req);
    }
  }

  if (action === "admin_delete_break_registration") {
    if (!(await requireAdminAgent(req, res, body))) return;

    const registrationId = String(body.id || "").trim();
    if (!registrationId) {
      return json(
        res,
        400,
        { error: "invalid_fields", message: "חסר מזהה הרשמה" },
        req
      );
    }

    try {
      await adminDeleteBreakRegistration(registrationId);
      return json(res, 200, { ok: true }, req);
    } catch (err) {
      console.error("[agent-auth] admin_delete_break_registration", err);
      const message =
        String(err?.message || "") === "not_found"
          ? "ההרשמה לא נמצאה"
          : "לא הצלחנו להסיר את ההרשמה";
      return json(res, 500, { error: "delete_failed", message }, req);
    }
  }

  if (action === "provision_auth") {
    if (!(await requireAdminAgent(req, res, body))) return;

    const agentId = String(body.agentId || body.id || "").trim();
    if (!agentId) {
      return json(res, 400, { error: "agent_id_required" }, req);
    }

    try {
      const agent = await getAgentById(agentId);
      if (!agent) {
        return json(res, 404, { error: "not_found", message: "נציג לא נמצא" }, req);
      }

      const result = await provisionAuthUserForAgent(agent);
      return json(res, 200, { ok: true, ...result }, req);
    } catch (err) {
      console.error("[agent-auth] provision_auth", err);
      const message =
        err.message === "invalid_agent_email"
          ? "נדרש אימייל אמיתי לנציג"
          : "לא הצלחנו ליצור משתמש Auth";
      return json(res, 500, { error: err.message || "provision_failed", message }, req);
    }
  }

  if (action === "mint" || action === "resolve") {
    if (!guestLinkApiReady()) {
      return json(
        res,
        503,
        {
          error: "guest_link_not_configured",
          message: "הגדר GUEST_LINK_SECRET ב-Vercel (32+ תווים אקראיים)",
        },
        req
      );
    }

    if (action === "mint") {
      const auth = await verifyBearerAgent(req);
      if (!auth?.agent) {
        return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות נציג" }, req);
      }

      const sessionId = String(body.sessionId || "").trim();
      const kind = body.kind === "consent" ? "consent" : body.kind === "screen" ? "screen" : null;
      const result = await mintGuestLinkForSession({
        sessionId,
        kind,
        agent: auth.agent,
      });

      if (!result.ok) {
        const status =
          result.error === "forbidden"
            ? 403
            : result.error === "not_found"
              ? 404
              : 400;
        return json(res, status, result, req);
      }

      auditGuestAccess("mint_ok", { req, sessionId, extra: { agent: auth.agent.displayName } });
      return json(res, 200, result, req);
    }

    if (!enforceIpRateLimit(res, req, guestResolveRateByIp, GUEST_RESOLVE_RATE_MAX)) return;

    const token = String(body.token || "").trim();
    if (!token) {
      return json(res, 400, { error: "invalid_token" }, req);
    }

    const result = await resolveGuestLinkFromToken(token, { req });
    if (!result.ok) {
      const status = result.error === "ended" ? 410 : result.error === "expired" ? 410 : 404;
      return json(res, status, result, req);
    }

    return json(res, 200, result, req);
  }

  if (action === "guest_session") {
    if (!guestLinkApiReady()) {
      return json(res, 503, { error: "guest_link_not_configured" }, req);
    }
    if (!enforceIpRateLimit(res, req, guestSessionRateByIp, GUEST_SESSION_POLL_RATE_MAX)) return;

    const token = String(body.token || body.guestToken || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    if (!token || !sessionId) {
      return json(res, 400, { error: "invalid_request" }, req);
    }

    const result = await fetchGuestSessionState({ token, sessionId });
    if (!result.ok) {
      const status =
        result.error === "ended"
          ? 410
          : result.error === "expired" || result.error === "invalid_token"
            ? 403
            : result.error === "not_found"
              ? 404
              : 400;
      return json(res, status, result, req);
    }
    return json(res, 200, result, req);
  }

  if (action === "guest_chat_list" || action === "guest_chat_send") {
    if (!guestLinkApiReady()) {
      return json(res, 503, { error: "guest_link_not_configured" }, req);
    }
    if (!enforceIpRateLimit(res, req, guestChatRateByIp, GUEST_CHAT_RATE_MAX)) return;

    const token = String(body.token || body.guestToken || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    if (!token || !sessionId) {
      return json(res, 400, { error: "invalid_request" }, req);
    }

    if (action === "guest_chat_list") {
      const result = await listGuestSessionChatMessages({ token, sessionId, limit: body.limit });
      if (!result.ok) {
        const status =
          result.error === "ended"
            ? 410
            : result.error === "expired" || result.error === "invalid_token"
              ? 403
              : 400;
        return json(res, status, result, req);
      }
      return json(res, 200, result, req);
    }

    const result = await insertGuestSessionChatMessage({
      token,
      sessionId,
      messageId: body.messageId,
      body: body.body,
      senderLabel: body.senderLabel,
    });
    if (!result.ok) {
      const status =
        result.error === "ended"
          ? 410
          : result.error === "expired" || result.error === "invalid_token"
            ? 403
            : 400;
      return json(res, status, result, req);
    }
    auditGuestAccess("guest_chat_send", { req, sessionId });
    return json(res, 200, result, req);
  }

  if (action === "support_file_upload") {
    const result = await handleSupportFileUpload(req, body);
    if (!result.ok) {
      const status =
        result.error === "unauthorized" || result.error === "forbidden"
          ? 401
          : result.error === "not_found"
            ? 404
            : result.error === "ended"
              ? 410
              : result.error === "invalid_token" || result.error === "expired"
                ? 403
                : 400;
      return json(res, status, result, req);
    }
    return json(res, 200, result, req);
  }

  if (action === "support_file_signed_url") {
    const result = await handleSupportFileSignedUrl(req, body);
    if (!result.ok) {
      const status =
        result.error === "unauthorized" || result.error === "forbidden"
          ? 401
          : result.error === "not_found"
            ? 404
            : result.error === "ended"
              ? 410
              : result.error === "invalid_token" || result.error === "expired"
                ? 403
                : 400;
      return json(res, status, result, req);
    }
    return json(res, 200, result, req);
  }

  if (action === "recording_upload") {
    const result = await handleRecordingUpload(req, body);
    if (!result.ok) {
      const status =
        result.error === "unauthorized" || result.error === "forbidden"
          ? 401
          : result.error === "not_found"
            ? 404
            : result.error === "ended"
              ? 410
              : 400;
      return json(res, status, result, req);
    }
    return json(res, 200, result, req);
  }

  return json(res, 400, { error: "unknown_action" }, req);
}
