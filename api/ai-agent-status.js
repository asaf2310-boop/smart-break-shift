/** GET /api/ai-agent-status — read-only config overview for admins. */

import { json, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { verifyAdminAgent } from "../server/agent/agentAuthService.js";
import { isOpenAiConfigured, getOpenAiChatModel } from "../server/ai/openaiClient.js";
import { getSupabaseAdmin } from "../server/knowledge/supabaseAdmin.js";
import { ALLOWED_TABLES, ALLOWED_COLUMNS } from "../server/ai-agent/getBusinessData.js";

const RATE_MAX_PER_HOUR = 30;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  const auth = await verifyAdminAgent(req, {});
  if (!auth) {
    return json(res, 401, { error: "unauthorized", message: "נדרשת הרשאת מנהל" }, req);
  }

  const supabase = getSupabaseAdmin();
  /** @type {Record<string, { ok: boolean, error?: string }>} */
  const tableStatus = {};

  if (supabase) {
    for (const table of ALLOWED_TABLES) {
      const { error } = await supabase.from(table).select("id").limit(1);
      tableStatus[table] = error
        ? { ok: false, error: String(error.code || error.message || "query_failed") }
        : { ok: true };
    }
  }

  return json(
    res,
    200,
    {
      openaiConfigured: isOpenAiConfigured(),
      openaiModel: getOpenAiChatModel(),
      supabaseConfigured: Boolean(supabase),
      allowedTables: ALLOWED_TABLES,
      allowedColumns: ALLOWED_COLUMNS,
      tableStatus,
      rateLimit: { maxPerHour: RATE_MAX_PER_HOUR },
      agentModuleId: "ai_agent",
      agentPath: "/ai-agent",
    },
    req,
  );
}
