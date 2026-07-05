/** Server-side module gates — mirrors src/constants/agentModules.js */

const MODULE_DENY_PREFIX = "!";

const AGENT_MODULE_IDS = [
  "breaks",
  "shifts",
  "training",
  "metrics",
  "remote_support",
  "customer_chat",
  "internal_chat",
  "crm",
  "ai_agent",
  "knowledge_guide",
  "google_review",
];

const MODULES_DEFAULT_ON_IF_MISSING = new Set(["google_review"]);

function isModuleExplicitlyDenied(modules, moduleId) {
  if (!Array.isArray(modules)) return false;
  return modules.includes(`${MODULE_DENY_PREFIX}${moduleId}`);
}

function normalizeAgentModules(modules) {
  if (modules === undefined || modules === null) {
    return [...AGENT_MODULE_IDS];
  }
  if (!Array.isArray(modules)) {
    return [...AGENT_MODULE_IDS];
  }
  if (modules.length === 0) {
    return [];
  }
  const unique = [...new Set(modules.map((m) => String(m || "").trim()).filter(Boolean))];
  return unique.filter((id) => AGENT_MODULE_IDS.includes(id));
}

function hasLegacyKnowledgeChatModule(modules) {
  return Array.isArray(modules) && modules.includes("knowledge_chat");
}

/** @param {string[] | null | undefined} modules */
export function agentHasModule(modules, moduleId) {
  if (isModuleExplicitlyDenied(modules, moduleId)) return false;
  if (hasLegacyKnowledgeChatModule(modules) && moduleId === "ai_agent") {
    return true;
  }
  const normalized = normalizeAgentModules(modules);
  if (normalized.includes(moduleId)) return true;
  if (
    MODULES_DEFAULT_ON_IF_MISSING.has(moduleId) &&
    (modules === undefined || modules === null)
  ) {
    return true;
  }
  if (
    MODULES_DEFAULT_ON_IF_MISSING.has(moduleId) &&
    Array.isArray(modules) &&
    modules.length > 0
  ) {
    return true;
  }
  return false;
}
