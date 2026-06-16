/** Vercel serverless — signed guest support links (mint + resolve). */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { verifyBearerAgent } from "../server/agent/agentAuthService.js";
import {
  guestLinkApiReady,
  mintGuestLinkForSession,
  resolveGuestLinkFromToken,
} from "../server/guest/guestLinkService.js";

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

  if (action === "resolve") {
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

  return json(res, 400, { error: "unknown_action" }, req);
}
