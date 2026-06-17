/** Vercel serverless — agent auth, guest links, storage uploads (phase 5). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
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
  verifyAdminPin,
  verifyBearerAgent,
} from "../server/agent/agentAuthService.js";
import { requestPasswordResetByEmail, requestFirstLoginByEmail } from "../server/agent/agentPasswordResetService.js";
import {
  guestLinkApiReady,
  mintGuestLinkForSession,
  resolveGuestLinkFromToken,
} from "../server/guest/guestLinkService.js";
import { handleIceServersRequest } from "../server/webrtc/iceServersService.js";

const PASSWORD_MIN_LENGTH = 6;

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
    if (!verifyAdminPin(body)) {
      return json(res, 403, { error: "forbidden", message: "אין הרשאה" }, req);
    }

    const agentId = String(body.agentId || body.id || "").trim();
    const password = String(body.password || "");
    const forceSetup = body.forceSetup !== false;

    if (!agentId || password.length < PASSWORD_MIN_LENGTH) {
      return json(
        res,
        400,
        { error: "invalid_fields", message: "סיסמה חייבת להכיל לפחות 6 תווים" },
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

  if (action === "provision_auth") {
    if (!verifyAdminPin(body)) {
      return json(res, 403, { error: "forbidden", message: "אין הרשאה" }, req);
    }

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

      return json(res, 200, result, req);
    }

    const token = String(body.token || "").trim();
    if (!token) {
      return json(res, 400, { error: "invalid_token" }, req);
    }

    const result = await resolveGuestLinkFromToken(token);
    if (!result.ok) {
      const status = result.error === "ended" ? 410 : result.error === "expired" ? 410 : 404;
      return json(res, status, result, req);
    }

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
