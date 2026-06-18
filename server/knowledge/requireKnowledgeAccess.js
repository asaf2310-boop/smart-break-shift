import { json } from "./httpUtils.js";
import { verifyAdminAgent, verifyKnowledgeAccess } from "../agent/agentAuthService.js";

/** Bearer JWT + knowledge module or is_admin. isSameOrigin must be checked separately. */
export async function requireKnowledgeAccess(req, res) {
  const auth = await verifyKnowledgeAccess(req);
  if (!auth?.agent) {
    json(res, 401, { error: "unauthorized", message: "נדרשת התחברות עם הרשאת ידע" }, req);
    return null;
  }
  return auth;
}

/** Ingest / delete / reprocess — admin only (read stays module-scoped). */
export async function requireKnowledgeAdminAccess(req, res) {
  const auth = await verifyAdminAgent(req);
  if (!auth?.agent) {
    json(res, 403, { error: "forbidden", message: "נדרשת הרשאת מנהל לניהול מסמכי ידע" }, req);
    return null;
  }
  return auth;
}
