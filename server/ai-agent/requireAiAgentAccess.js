import { json } from "../knowledge/httpUtils.js";
import { verifyAiAgentAccess } from "../agent/agentAuthService.js";

/** Bearer JWT + ai_agent module or is_admin. isSameOrigin must be checked separately. */
export async function requireAiAgentAccess(req, res) {
  const auth = await verifyAiAgentAccess(req);
  if (!auth?.agent) {
    json(res, 401, { error: "unauthorized", message: "נדרשת התחברות עם הרשאת סוכן AI" }, req);
    return null;
  }
  return auth;
}
