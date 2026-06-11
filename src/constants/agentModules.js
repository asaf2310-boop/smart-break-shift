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
];

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
};

export const DEFAULT_AGENT_MODULES = [...AGENT_MODULE_IDS];

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
  return normalizeAgentModules(modules).includes(moduleId);
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

  const normalized = normalizeAgentModules(modules);
  for (const moduleId of normalized) {
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
  const list = normalizeAgentModules(modules);
  if (list.length === AGENT_MODULE_IDS.length) return "כל המודולים";
  if (!list.length) return "ללא מודולים";
  return list.map((id) => AGENT_MODULES[id]?.label || id).join(" · ");
}
