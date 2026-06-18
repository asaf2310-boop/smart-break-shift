/** Vercel serverless — agent auth, guest links, storage uploads (phase 5). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import {
  checkRateLimitHybrid,
  getClientIp,
  getRateLimitKey,
  rateLimitHebrewMessage,
  recordRateLimitHybrid,
  setRateLimitHeaders,
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
import { mintWebrtcJoinToken, authorizeWebrtcJoin } from "../server/webrtc/webrtcJoinService.js";
import { webrtcJoinRequireEnabled } from "../server/webrtc/webrtcJoinToken.js";
import { verifyOrBindGuestTokenFingerprint } from "../server/guest/guestLinkRedemption.js";
import { logSecurityEvent } from "../server/security/auditLog.js";
import { listSecurityAuditLog } from "../server/security/auditLogListService.js";
import { getSmsStatsByAgent } from "../server/security/smsStatsService.js";
import { endSupportSessionByAgent } from "../server/support/supportSessionEndService.js";
import { sendReviewSmsToCustomer } from "../server/sms/reviewSmsService.js";
import {
  DEFAULT_REVIEW_SMS_TEMPLATE,
  REVIEW_SMS_MAX_LENGTH,
} from "../server/review/reviewLink.js";
import {
  getReviewSmsSettingsPayload,
  maskReviewSmsUrl,
  setStoredGoogleReviewSmsUrl,
} from "../server/review/reviewSmsSettingsService.js";
import {
  mintSipTokenForAgent,
  redeemSipTokenForAgent,
} from "../server/sip/sipTokenService.js";

const PASSWORD_MIN_LENGTH = 12;

const guestResolveRateByIp = new Map();
const guestSessionRateByIp = new Map();
const guestChatRateByIp = new Map();
const guestMintRateByUser = new Map();
const webrtcJoinRateByIp = new Map();
const webrtcJoinRateByUser = new Map();
const adminActionRateByUser = new Map();
const supportEndRateByUser = new Map();
const reviewSmsRateByUser = new Map();
const sipTokenRateByUser = new Map();
const passwordResetRateByIp = new Map();
const storageUploadRateByKey = new Map();

const GUEST_RESOLVE_RATE_MAX = 60;
const GUEST_SESSION_POLL_RATE_MAX = 240;
const GUEST_CHAT_RATE_MAX = 120;
const ICE_SERVERS_RATE_MAX = 120;
const GUEST_MINT_RATE_MAX = 120;
const WEBRTC_JOIN_RATE_MAX = 90;
const ADMIN_ACTION_RATE_MAX = 60;
const SUPPORT_END_RATE_MAX = 120;
const REVIEW_SMS_RATE_MAX = 30;
const REVIEW_SMS_RATE_WINDOW_MS = 60 * 60 * 1000;
const SIP_TOKEN_RATE_MAX = 30;
const SIP_TOKEN_RATE_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_RATE_MAX = 12;
const PASSWORD_RESET_RATE_WINDOW_MS = 60 * 60 * 1000;
const STORAGE_UPLOAD_RATE_MAX = 90;

function rateLimitResponse(res, req, retryAfterSec) {
  const sec = setRateLimitHeaders(res, retryAfterSec);
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

async function enforceIpRateLimit(res, req, store, max, prefix = "ip") {
  const ip = getClientIp(req);
  const check = await checkRateLimitHybrid({
    prefix,
    key: `ip:${ip}`,
    store,
    max,
  });
  if (!check.allowed) {
    rateLimitResponse(res, req, check.retryAfterSec);
    return false;
  }
  await recordRateLimitHybrid(check.entry);
  return true;
}

async function enforceUserRateLimit(res, req, store, max, userId, windowMs, prefix = "user") {
  const key = getRateLimitKey(req, userId);
  const check = await checkRateLimitHybrid({
    prefix,
    key,
    store,
    max,
    windowMs,
  });
  if (!check.allowed) {
    rateLimitResponse(res, req, check.retryAfterSec);
    return false;
  }
  await recordRateLimitHybrid(check.entry);
  return true;
}

async function enforceIpRateLimitWindow(res, req, store, max, windowMs, prefix = "ip_window") {
  const ip = getClientIp(req);
  const check = await checkRateLimitHybrid({
    prefix,
    key: `ip:${ip}`,
    store,
    max,
    windowMs,
  });
  if (!check.allowed) {
    rateLimitResponse(res, req, check.retryAfterSec);
    return false;
  }
  await recordRateLimitHybrid(check.entry);
  return true;
}

async function enforceStorageUploadRateLimit(res, req) {
  const auth = await verifyBearerAgent(req);
  const key = auth?.agent?.id
    ? getRateLimitKey(req, auth.agent.id)
    : `ip:${getClientIp(req)}`;
  const check = await checkRateLimitHybrid({
    prefix: "storage_upload",
    key,
    store: storageUploadRateByKey,
    max: STORAGE_UPLOAD_RATE_MAX,
  });
  if (!check.allowed) {
    rateLimitResponse(res, req, check.retryAfterSec);
    return false;
  }
  await recordRateLimitHybrid(check.entry);
  return true;
}

async function requireAdminAgent(req, res, body) {
  const auth = await verifyAdminAgent(req, body);
  if (!auth?.agent) {
    json(res, 403, { error: "forbidden", message: "נדרשת הרשאת מנהל" }, req);
    return null;
  }
  if (!await enforceUserRateLimit(res, req, adminActionRateByUser, ADMIN_ACTION_RATE_MAX, auth.agent.id, undefined, "admin_action")) {
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
    if (!await enforceIpRateLimit(res, req, guestResolveRateByIp, ICE_SERVERS_RATE_MAX, "ice_servers")) return;

    const guestToken = String(body.guestToken || "").trim();
    const joinToken = String(body.joinToken || body.webrtcJoinToken || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    let authorized = false;
    let joinRole = null;

    if (guestToken) {
      const verified = verifyGuestLinkToken(guestToken);
      if (verified.ok) {
        if (sessionId && verified.sessionId !== sessionId) {
          return json(res, 403, { error: "session_mismatch" }, req);
        }
        const bind = await verifyOrBindGuestTokenFingerprint(
          guestToken,
          verified.sessionId,
          req
        );
        if (!bind.ok) {
          return json(res, 403, bind, req);
        }
        authorized = true;
        joinRole = "guest";
      }
    } else {
      const auth = await verifyBearerAgent(req);
      if (auth?.agent) {
        authorized = true;
        joinRole = "agent";
      }
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

    if (webrtcJoinRequireEnabled()) {
      if (!joinToken || !sessionId) {
        return json(res, 403, { error: "join_token_required" }, req);
      }
      const auth = joinRole === "agent" ? await verifyBearerAgent(req) : null;
      const joinAuth = await authorizeWebrtcJoin({
        joinToken,
        sessionId,
        role: joinRole,
        agent: auth?.agent || null,
        req,
      });
      if (!joinAuth.ok) {
        return json(res, 403, joinAuth, req);
      }
    }

    return handleIceServersRequest(res, req);
  }

  if (action === "webrtc_join_mint") {
    if (!guestLinkApiReady()) {
      return json(res, 503, { error: "guest_link_not_configured" }, req);
    }

    const sessionId = String(body.sessionId || "").trim();
    const role = body.role === "guest" ? "guest" : body.role === "agent" ? "agent" : null;
    if (!sessionId || !role) {
      return json(res, 400, { error: "invalid_request" }, req);
    }

    if (role === "agent") {
      const auth = await verifyBearerAgent(req);
      if (!auth?.agent) {
        return json(res, 401, { error: "unauthorized" }, req);
      }
      if (
        !await enforceUserRateLimit(res, req, webrtcJoinRateByUser, WEBRTC_JOIN_RATE_MAX, auth.agent.id, undefined, "webrtc_join")
      ) {
        return;
      }

      const result = await mintWebrtcJoinToken({
        sessionId,
        role: "agent",
        agent: auth.agent,
        req,
      });
      if (!result.ok) {
        const status =
          result.error === "forbidden"
            ? 403
            : result.error === "not_found"
              ? 404
              : result.error === "ended"
                ? 410
                : 400;
        return json(res, status, result, req);
      }

      void logSecurityEvent({
        action: "remote_session_start",
        actorAgentId: auth.agent.id,
        resourceType: "support_session",
        resourceId: sessionId,
        metadata: { role: "agent" },
        req,
      });

      return json(res, 200, result, req);
    }

    if (!await enforceIpRateLimit(res, req, webrtcJoinRateByIp, WEBRTC_JOIN_RATE_MAX, "webrtc_join_ip")) return;

    const guestToken = String(body.guestToken || body.token || "").trim();
    if (!guestToken) {
      return json(res, 400, { error: "invalid_token" }, req);
    }

    const result = await mintWebrtcJoinToken({
      sessionId,
      role: "guest",
      guestToken,
      req,
    });
    if (!result.ok) {
      const status =
        result.error === "fingerprint_mismatch" || result.error === "invalid_token"
          ? 403
          : result.error === "ended"
            ? 410
            : result.error === "not_found"
              ? 404
              : 400;
      return json(res, status, result, req);
    }

    void logSecurityEvent({
      action: "remote_session_start",
      resourceType: "support_session",
      resourceId: sessionId,
      metadata: { role: "guest" },
      req,
    });

    return json(res, 200, result, req);
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
    if (
      !await enforceIpRateLimitWindow(
        res,
        req,
        passwordResetRateByIp,
        PASSWORD_RESET_RATE_MAX,
        PASSWORD_RESET_RATE_WINDOW_MS,
        "password_reset"
      )
    ) {
      return;
    }

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
    if (
      !await enforceIpRateLimitWindow(
        res,
        req,
        passwordResetRateByIp,
        PASSWORD_RESET_RATE_MAX,
        PASSWORD_RESET_RATE_WINDOW_MS,
        "first_login"
      )
    ) {
      return;
    }

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
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

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

      void logSecurityEvent({
        action: "admin_set_password",
        actorAgentId: auth.agent.id,
        resourceType: "agent",
        resourceId: agentId,
        metadata: { forceSetup },
        req,
      });

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
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

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
      void logSecurityEvent({
        action: "admin_create_break_registration",
        actorAgentId: auth.agent.id,
        resourceType: "break_registration",
        resourceId: registration?.id,
        metadata: { agent_name, break_type, time_slot, date },
        req,
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

  if (action === "review_sms_config" || action === "get_review_sms_settings") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות" }, req);
    }

    const settings = await getReviewSmsSettingsPayload();
    return json(
      res,
      200,
      {
        ok: settings.ok,
        configured: settings.ok,
        smsUrl: settings.smsUrl,
        source: settings.source,
        dbUrl: settings.dbUrl,
        dbTargetUrl: settings.dbTargetUrl,
        dbUrlMasked: settings.dbUrl ? maskReviewSmsUrl(settings.dbUrl) : null,
        dbTargetUrlMasked: settings.dbTargetUrl ? maskReviewSmsUrl(settings.dbTargetUrl) : null,
        dbError: settings.dbError || null,
        dbErrorMessage: settings.dbErrorMessage || null,
        error: settings.error || null,
        message: settings.message || null,
        template: DEFAULT_REVIEW_SMS_TEMPLATE,
        maxLength: REVIEW_SMS_MAX_LENGTH,
      },
      req
    );
  }

  if (action === "update_review_sms_settings") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

    const googleReviewSmsUrl = String(
      body.google_review_sms_url ?? body.googleReviewSmsUrl ?? body.url ?? ""
    ).trim();

    const saved = await setStoredGoogleReviewSmsUrl(googleReviewSmsUrl, auth.agent.id);
    if (!saved.ok) {
      return json(
        res,
        400,
        { error: saved.error || "invalid_url", message: saved.message || "קישור לא תקין" },
        req
      );
    }

    void logSecurityEvent({
      action: "update_review_sms_settings",
      actorAgentId: auth.agent.id,
      resourceType: "app_settings",
      resourceId: "google_review_sms_url",
      metadata: {
        urlLength: saved.url.length,
        shortened: Boolean(saved.shortened),
        shortenProvider: saved.shortenProvider || null,
      },
      req,
    });

    const settings = await getReviewSmsSettingsPayload();
    return json(
      res,
      200,
      {
        ok: true,
        smsUrl: settings.smsUrl,
        source: settings.source,
        dbUrl: settings.dbUrl,
        dbTargetUrl: settings.dbTargetUrl,
        dbUrlMasked: settings.dbUrl ? maskReviewSmsUrl(settings.dbUrl) : null,
        dbTargetUrlMasked: settings.dbTargetUrl ? maskReviewSmsUrl(settings.dbTargetUrl) : null,
        shortened: Boolean(saved.shortened),
        shortenProvider: saved.shortenProvider || null,
        message: saved.message || "קישור דירוג נשמר בהצלחה",
        template: DEFAULT_REVIEW_SMS_TEMPLATE,
        maxLength: REVIEW_SMS_MAX_LENGTH,
      },
      req
    );
  }

  if (action === "send_review_sms") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות" }, req);
    }

    const key = getRateLimitKey(req, auth.agent.id);
    const rateCheck = await checkRateLimitHybrid({
      prefix: "review_sms",
      key,
      store: reviewSmsRateByUser,
      max: REVIEW_SMS_RATE_MAX,
      windowMs: REVIEW_SMS_RATE_WINDOW_MS,
    });
    if (!rateCheck.allowed) {
      return rateLimitResponse(res, req, rateCheck.retryAfterSec);
    }
    await recordRateLimitHybrid(rateCheck.entry);

    const phone = String(body.phone || body.to || "").trim();
    const allowCustomMessage = Boolean(auth.agent.isAdmin);
    const customMessage = allowCustomMessage
      ? String(body.message || body.customMessage || "").trim()
      : "";

    try {
      const result = await sendReviewSmsToCustomer({
        phone,
        customMessage,
        allowCustomMessage,
        actorAgentId: auth.agent.id,
        actorName: auth.agent.name,
        req,
      });

      if (!result.ok) {
        const status =
          result.error === "invalid_phone" ||
          result.error === "review_url_not_configured" ||
          result.error === "review_sms_url_not_configured" ||
          result.error === "message_too_long"
            ? 400
            : result.error === "sms_not_configured"
              ? 503
              : 502;
        return json(res, status, result, req);
      }

      return json(res, 200, result, req);
    } catch (err) {
      console.error("[agent-auth] send_review_sms", err);
      return json(
        res,
        502,
        { ok: false, error: "sms_send_failed", message: err.message || "שליחת SMS נכשלה" },
        req
      );
    }
  }

  if (action === "admin_list_audit_log") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

    try {
      const result = await listSecurityAuditLog({
        limit: body.limit,
        offset: body.offset,
        action: body.filterAction,
      });
      if (!result.ok) {
        return json(res, 500, result, req);
      }
      return json(res, 200, result, req);
    } catch (err) {
      console.error("[agent-auth] admin_list_audit_log", err);
      return json(
        res,
        500,
        { error: "load_failed", message: "לא הצלחנו לטעון את יומן הביקורת" },
        req
      );
    }
  }

  if (action === "admin_sms_stats_by_agent") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

    try {
      const result = await getSmsStatsByAgent({
        fromDate: body.fromDate ?? body.from_date ?? null,
        toDate: body.toDate ?? body.to_date ?? null,
        days: body.days,
      });
      if (!result.ok) {
        return json(res, 500, result, req);
      }
      return json(res, 200, result, req);
    } catch (err) {
      console.error("[agent-auth] admin_sms_stats_by_agent", err);
      return json(
        res,
        500,
        { error: "load_failed", message: "לא הצלחנו לטעון סטטיסטיקת SMS" },
        req
      );
    }
  }

  if (action === "admin_delete_break_registration") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

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
      void logSecurityEvent({
        action: "admin_delete_break_registration",
        actorAgentId: auth.agent.id,
        resourceType: "break_registration",
        resourceId: registrationId,
        req,
      });
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

  if (action === "admin_log_agent_change") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

    const agentId = String(body.agentId || body.id || "").trim();
    const changeType = String(body.changeType || body.change_type || "").trim();
    if (!agentId || !changeType) {
      return json(res, 400, { error: "invalid_fields", message: "חסרים שדות חובה" }, req);
    }

    const actionByChange = {
      create: "admin_agent_create",
      update: "admin_agent_update",
      modules: "admin_agent_modules",
      block: "admin_agent_block",
      unblock: "admin_agent_unblock",
      delete: "admin_agent_delete",
      crm_routing: "crm_routing_change",
    };
    const auditAction = actionByChange[changeType];
    if (!auditAction) {
      return json(res, 400, { error: "invalid_change_type" }, req);
    }

    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};
    void logSecurityEvent({
      action: auditAction,
      actorAgentId: auth.agent.id,
      resourceType: changeType === "crm_routing" ? "crm_routing_rule" : "agent",
      resourceId: agentId,
      metadata: { changeType, ...metadata },
      req,
    });
    return json(res, 200, { ok: true }, req);
  }

  if (action === "provision_auth") {
    const auth = await requireAdminAgent(req, res, body);
    if (!auth) return;

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
      void logSecurityEvent({
        action: "provision_auth",
        actorAgentId: auth.agent.id,
        resourceType: "agent",
        resourceId: agentId,
        metadata: { authUserId: result.authUserId },
        req,
      });
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
      if (!await enforceUserRateLimit(res, req, guestMintRateByUser, GUEST_MINT_RATE_MAX, auth.agent.id, undefined, "guest_mint")) {
        return;
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
      void logSecurityEvent({
        action: "guest_link_created",
        actorAgentId: auth.agent.id,
        resourceType: "support_session",
        resourceId: sessionId,
        metadata: { kind },
        req,
      });
      return json(res, 200, result, req);
    }

    if (!await enforceIpRateLimit(res, req, guestResolveRateByIp, GUEST_RESOLVE_RATE_MAX, "guest_resolve")) return;

    const token = String(body.token || "").trim();
    if (!token) {
      return json(res, 400, { error: "invalid_token" }, req);
    }

    const result = await resolveGuestLinkFromToken(token, { req });
    if (!result.ok) {
      const status =
        result.error === "ended" ||
        result.error === "already_used" ||
        result.error === "fingerprint_mismatch"
          ? 410
          : result.error === "expired"
            ? 410
            : 404;
      return json(res, status, result, req);
    }

    return json(res, 200, result, req);
  }

  if (action === "guest_session") {
    if (!guestLinkApiReady()) {
      return json(res, 503, { error: "guest_link_not_configured" }, req);
    }
    if (!await enforceIpRateLimit(res, req, guestSessionRateByIp, GUEST_SESSION_POLL_RATE_MAX, "guest_session")) return;

    const token = String(body.token || body.guestToken || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    if (!token || !sessionId) {
      return json(res, 400, { error: "invalid_request" }, req);
    }

    const result = await fetchGuestSessionState({ token, sessionId, req });
    if (!result.ok) {
      const status =
        result.error === "ended"
          ? 410
          : result.error === "expired" ||
              result.error === "invalid_token" ||
              result.error === "fingerprint_mismatch"
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
    if (!await enforceIpRateLimit(res, req, guestChatRateByIp, GUEST_CHAT_RATE_MAX, "guest_chat")) return;

    const token = String(body.token || body.guestToken || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    if (!token || !sessionId) {
      return json(res, 400, { error: "invalid_request" }, req);
    }

    if (action === "guest_chat_list") {
      const result = await listGuestSessionChatMessages({ token, sessionId, limit: body.limit, req });
      if (!result.ok) {
        const status =
          result.error === "ended"
            ? 410
            : result.error === "expired" ||
                result.error === "invalid_token" ||
                result.error === "fingerprint_mismatch"
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
      req,
    });
    if (!result.ok) {
      const status =
        result.error === "ended"
          ? 410
          : result.error === "expired" ||
              result.error === "invalid_token" ||
              result.error === "fingerprint_mismatch"
            ? 403
            : 400;
      return json(res, status, result, req);
    }
    auditGuestAccess("guest_chat_send", { req, sessionId });
    return json(res, 200, result, req);
  }

  if (action === "end_support_session") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות" }, req);
    }
    if (!await enforceUserRateLimit(res, req, supportEndRateByUser, SUPPORT_END_RATE_MAX, auth.agent.id, undefined, "support_end")) {
      return;
    }

    const sessionId = String(body.sessionId || "").trim();
    const endedReason = String(body.endedReason || "agent_ended").trim();

    if (!sessionId) {
      return json(res, 400, { error: "invalid_fields", message: "חסר מזהה סשן" }, req);
    }

    try {
      const result = await endSupportSessionByAgent({
        sessionId,
        agent: auth.agent,
        endedReason,
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

      if (!result.alreadyEnded) {
        void logSecurityEvent({
          action: "remote_session_end",
          actorAgentId: auth.agent.id,
          resourceType: "support_session",
          resourceId: sessionId,
          metadata: { endedReason: result.endedReason, sessionType: result.sessionType },
          req,
        });
        void logSecurityEvent({
          action: "support_session_end",
          actorAgentId: auth.agent.id,
          resourceType: "support_session",
          resourceId: sessionId,
          metadata: { endedReason: result.endedReason, sessionType: result.sessionType },
          req,
        });
      }

      return json(res, 200, { ok: true, ...result }, req);
    } catch (err) {
      console.error("[agent-auth] end_support_session", err);
      return json(res, 500, { error: "end_failed", message: "לא הצלחנו לסיים את הסשן" }, req);
    }
  }

  if (action === "support_file_upload") {
    if (!(await enforceStorageUploadRateLimit(res, req))) return;
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
    if (!(await enforceStorageUploadRateLimit(res, req))) return;
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
    if (!(await enforceStorageUploadRateLimit(res, req))) return;
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

  if (action === "sip_token_mint") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות נציג" }, req);
    }
    if (
      !await enforceUserRateLimit(
        res,
        req,
        sipTokenRateByUser,
        SIP_TOKEN_RATE_MAX,
        auth.agent.id,
        SIP_TOKEN_RATE_WINDOW_MS,
        "sip_token"
      )
    ) {
      return;
    }

    const agentKey = String(body.agent || body.agentName || "").trim() || null;
    const result = await mintSipTokenForAgent({ req, auth, agentKey });
    if (!result.ok) {
      return json(
        res,
        result.status || 400,
        { ok: false, reason: result.reason, error: result.reason },
        req
      );
    }
    const { status: _status, ...payload } = result;
    return json(res, 200, payload, req);
  }

  if (action === "sip_token_redeem") {
    const auth = await verifyBearerAgent(req);
    if (!auth?.agent) {
      return json(res, 401, { error: "unauthorized", message: "נדרשת התחברות נציג" }, req);
    }
    if (
      !await enforceUserRateLimit(
        res,
        req,
        sipTokenRateByUser,
        SIP_TOKEN_RATE_MAX,
        auth.agent.id,
        SIP_TOKEN_RATE_WINDOW_MS,
        "sip_token"
      )
    ) {
      return;
    }

    const result = await redeemSipTokenForAgent({
      req,
      auth,
      credentialToken: body.credentialToken,
    });
    if (!result.ok) {
      return json(
        res,
        result.status || 400,
        { ok: false, reason: result.reason, error: result.reason },
        req
      );
    }
    const { status: _status, ...payload } = result;
    return json(res, 200, payload, req);
  }

  return json(res, 400, { error: "unknown_action" }, req);
}
