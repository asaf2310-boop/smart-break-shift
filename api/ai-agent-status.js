/** GET /api/ai-agent-status — read-only config overview for admins. */

import { json, handleOptions, isSameOrigin } from "../server/knowledge/httpUtils.js";
import { verifyAdminAgent } from "../server/agent/agentAuthService.js";
import { isOpenAiConfigured, getOpenAiChatModel } from "../server/ai/openaiClient.js";
import { isGeminiConfigured, getGeminiChatModel } from "../server/ai/geminiClient.js";
import { getAiProvider, isAiConfigured } from "../server/ai/aiProvider.js";
import { probeOpenAiAccess } from "../server/ai/openaiErrors.js";
import { probeGeminiKeyPresence } from "../server/ai/geminiErrors.js";
import { getSupabaseAdmin } from "../server/knowledge/supabaseAdmin.js";
import { ALLOWED_TABLES, ALLOWED_COLUMNS } from "../server/ai-agent/getBusinessData.js";
import { getAiAgentDocumentCount } from "../server/ai-agent/documentIngestService.js";
import { isEmbeddingConfigured } from "../server/knowledge/embeddingService.js";
import {
  AI_AGENT_DOCUMENTS_MIGRATION_FILE,
  AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE,
  AI_AGENT_SCHEMA_MIGRATION_STEPS_HE,
} from "../server/ai-agent/schemaErrors.js";

const RATE_MAX_PER_HOUR = 30;

/** @type {{ at: number, result: { ok: boolean, error: string | null, message: string | null, quotaExceeded?: boolean } } | null} */
let openAiProbeCache = null;
/** @type {{ at: number, result: { ok: boolean, error: string | null, message: string | null, quotaExceeded?: boolean } } | null} */
let geminiProbeCache = null;
const PROBE_TTL_MS = 60 * 60 * 1000;

async function getOpenAiHealth() {
  if (!isOpenAiConfigured()) {
    return { ok: false, error: "not_configured", message: null, quotaExceeded: false };
  }

  const now = Date.now();
  if (openAiProbeCache && now - openAiProbeCache.at < PROBE_TTL_MS) {
    return openAiProbeCache.result;
  }

  const probe = await probeOpenAiAccess(
    () => String(process.env.OPENAI_API_KEY || "").trim(),
    getOpenAiChatModel,
  );
  const result = {
    ok: probe.ok,
    error: probe.error,
    message: probe.message,
    quotaExceeded: probe.error === "openai_quota_exceeded",
  };
  openAiProbeCache = { at: now, result };
  return result;
}

async function getGeminiHealth() {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "not_configured", message: null, quotaExceeded: false };
  }

  const now = Date.now();
  if (geminiProbeCache && now - geminiProbeCache.at < PROBE_TTL_MS) {
    return geminiProbeCache.result;
  }

  const probe = probeGeminiKeyPresence(() => String(process.env.GEMINI_API_KEY || "").trim());
  const result = {
    ok: probe.ok,
    error: probe.error,
    message: probe.message,
    quotaExceeded: false,
  };
  geminiProbeCache = { at: now, result };
  return result;
}

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

  const docStats = await getAiAgentDocumentCount();
  const documentsSchemaOk = docStats.error !== "schema_not_migrated";
  const provider = getAiProvider();
  const openaiHealth = await getOpenAiHealth();
  const geminiHealth = await getGeminiHealth();
  const activeHealth = provider === "openai" ? openaiHealth : geminiHealth;
  const quotaWarning =
    activeHealth.quotaExceeded && activeHealth.message ? activeHealth.message : null;

  return json(
    res,
    200,
    {
      provider,
      aiConfigured: isAiConfigured(),
      chatModel: provider === "openai" ? getOpenAiChatModel() : getGeminiChatModel(),
      aiHealth: activeHealth,
      aiQuotaWarning: quotaWarning,
      geminiConfigured: isGeminiConfigured(),
      geminiModel: getGeminiChatModel(),
      geminiHealth,
      geminiQuotaWarning:
        provider === "gemini" && geminiHealth.quotaExceeded ? geminiHealth.message : null,
      openaiConfigured: isOpenAiConfigured(),
      openaiModel: getOpenAiChatModel(),
      openaiHealth,
      openaiQuotaWarning:
        provider === "openai" && openaiHealth.quotaExceeded ? openaiHealth.message : null,
      supabaseConfigured: Boolean(supabase),
      embeddingsConfigured: isEmbeddingConfigured(),
      allowedTables: ALLOWED_TABLES,
      allowedColumns: ALLOWED_COLUMNS,
      tableStatus,
      documents: {
        count: docStats.count,
        schemaOk: documentsSchemaOk,
        error: documentsSchemaOk && docStats.error ? docStats.error : null,
        migrationFile: AI_AGENT_DOCUMENTS_MIGRATION_FILE,
        migrationMessage: documentsSchemaOk ? null : AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE,
        migrationSteps: documentsSchemaOk ? null : AI_AGENT_SCHEMA_MIGRATION_STEPS_HE,
      },
      rateLimit: { maxPerHour: RATE_MAX_PER_HOUR },
      agentModuleId: "ai_agent",
      agentPath: "/ai-agent",
      documentsAdminPath: "/admin/knowledge/ai-agent",
    },
    req,
  );
}
