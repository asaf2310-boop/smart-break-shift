/** POST /api/ai-agent — OpenAI agent with read-only Supabase tool calling. */

import { json, readJsonBody, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { requireAiAgentAccess } from "../server/ai-agent/requireAiAgentAccess.js";
import { runAiAgent } from "../server/ai-agent/aiAgentService.js";
import {
  checkRateLimit,
  getRateLimitKey,
  rateLimitHebrewMessage,
  recordRateLimit,
  setRateLimitHeaders,
} from "../server/http/rateLimit.js";

const aiAgentRateByKey = new Map();
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  const auth = await requireAiAgentAccess(req, res);
  if (!auth) return;

  const rateKey = getRateLimitKey(req, auth.agent?.id);
  const rate = checkRateLimit(aiAgentRateByKey, `ai-agent:${rateKey}`, RATE_MAX, RATE_WINDOW_MS);
  if (!rate.allowed) {
    setRateLimitHeaders(res, rate.retryAfterSec);
    return json(
      res,
      429,
      { error: "rate_limited", message: rateLimitHebrewMessage(rate.retryAfterSec) },
      req,
    );
  }
  recordRateLimit(rate.entry);

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  const message = String(body.message || "").trim();
  if (!message) {
    return json(res, 400, { error: "message_required", message: "נדרשת הודעה" }, req);
  }

  let result;
  try {
    result = await runAiAgent(message);
  } catch {
    return json(
      res,
      500,
      { error: "internal_error", message: "שגיאת שרת — נסו שוב בעוד רגע" },
      req,
    );
  }

  if (!result.ok) {
    const status =
      result.error === "ai_not_configured"
        ? 503
        : result.error === "rate_limited"
          ? 429
          : 400;
    return json(res, status, { error: result.error, message: result.message }, req);
  }

  return json(res, 200, { reply: result.reply, toolRounds: result.toolRounds ?? 0 }, req);
}
