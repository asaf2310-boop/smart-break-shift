/** מזהי מודולים שניתן להקצות לנציג */
export const AGENT_MODULE_IDS = [
  "breaks",
  "shifts",
  "training",
  "metrics",
  "remote_support",
  "customer_chat",
  "internal_chat",
  "crm",
  "knowledge",
  "google_review",
];

/** מודולים שמופעלים כברירת מחדל גם כשחסרים ברשומה ישנה (לפני מיגרציה) */
const MODULES_DEFAULT_ON_IF_MISSING = new Set(["google_review"]);

const MODULE_DENY_PREFIX = "!";

/** @type {Record<string, { label: string, paths: string[] }>} */
export const AGENT_MODULES = {
  breaks: { label: "הפסקות", paths: ["/breaks"] },
  shifts: { label: "משמרות", paths: ["/shifts"] },
  training: { label: "הדרכה", paths: ["/training"] },
  metrics: { label: "מדדים", paths: ["/metrics"] },
  remote_support: { label: "השתלטות מרחוק", paths: ["/remote-support"] },
  customer_chat: { label: "צ'אט לקוחות", paths: ["/customer-chat"] },
  internal_chat: { label: "צ'אט פנימי", paths: ["/chat"] },
  crm: { label: "CRM", paths: ["/crm"] },
  knowledge: { label: "בסיס ידע", paths: ["/knowledge"] },
  google_review: { label: "דירוג בגוגל", paths: ["/review-sms"] },
};

export const DEFAULT_AGENT_MODULES = [...AGENT_MODULE_IDS];

export function isModuleExplicitlyDenied(modules, moduleId) {
  if (!Array.isArray(modules)) return false;
  return modules.includes(`${MODULE_DENY_PREFIX}${moduleId}`);
}

export function normalizeAgentModules(modules) {
  if (modules === undefined || modules === null) {
    return [...DEFAULT_AGENT_MODULES];
  }
  if (!Array.isArray(modules)) {
    return [...DEFAULT_AGENT_MODULES];
  }
  if (modules.length === 0) {
    return [];
  }
  const unique = [...new Set(modules.map((m) => String(m || "").trim()).filter(Boolean))];
  return unique.filter((id) => AGENT_MODULE_IDS.includes(id));
}

export function agentHasModule(modules, moduleId) {
  if (isModuleExplicitlyDenied(modules, moduleId)) return false;
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

/** ערכי תיבות סימון בממשק אדמין (כולל ברירת מחדל לרשומות ישנות) */
export function modulesForPicker(modules) {
  return AGENT_MODULE_IDS.filter((id) => agentHasModule(modules, id));
}

/** שמירה ל-DB — מוסיף סימון שלילי (!module) כשמודול עם ברירת מחדל כבוי */
export function modulesFromPicker(selectedIds) {
  const selected = new Set(normalizeAgentModules(selectedIds));
  const stored = [...selected];
  for (const id of MODULES_DEFAULT_ON_IF_MISSING) {
    if (!selected.has(id)) {
      stored.push(`${MODULE_DENY_PREFIX}${id}`);
    }
  }
  return stored;
}

export function filterItemsByModules(items, modules, moduleKey = "module") {
  return items.filter((item) => {
    const id = item[moduleKey];
    if (!id) return true;
    return agentHasModule(modules, id);
  });
}

export function pathnameAllowedByModules(pathname, modules) {
  if (!pathname || pathname === "/") return true;

  for (const moduleId of AGENT_MODULE_IDS) {
    if (!agentHasModule(modules, moduleId)) continue;
    const def = AGENT_MODULES[moduleId];
    if (!def?.paths?.length) continue;
    for (const base of def.paths) {
      if (pathname === base || pathname.startsWith(`${base}/`)) {
        return true;
      }
    }
  }
  return false;
}

export function formatModulesSummary(modules) {
  const enabled = AGENT_MODULE_IDS.filter((id) => agentHasModule(modules, id));
  if (enabled.length === AGENT_MODULE_IDS.length) return "כל המודולים";
  if (!enabled.length) return "ללא מודולים";
  return enabled.map((id) => AGENT_MODULES[id]?.label || id).join(" · ");
}
