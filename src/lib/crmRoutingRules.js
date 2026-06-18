import { getAgentNamesList } from "@/constants/scheduling";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import {
  deleteRoutingRuleFromCloud,
  loadRoutingRulesFromCloud,
  persistRoutingRulesToCloud,
} from "@/lib/crmCloudSync";

const CRM_ROUTING_RULES_STORAGE_KEY = "smart-break-shift-crm-routing-rules-v1";
const CRM_ROUTING_RULES_CHANGE_EVENT = "crm-routing-rules-changed";

const DEFAULT_ROUTING_RULES = [
  {
    id: "rule_billing",
    referral_topic: "חשבוניות",
    assigned_to_type: "department",
    assigned_department_id: "billing",
    assigned_agent_name: null,
    sort_order: 0,
  },
  {
    id: "rule_sales",
    referral_topic: "סליקה",
    assigned_to_type: "department",
    assigned_department_id: "sales",
    assigned_agent_name: null,
    sort_order: 1,
  },
];

let memoryRules = null;
let hydrateRulesPromise = null;
let cloudRulesHydrated = false;

function normalizeRule(rule) {
  if (!rule) return null;
  const id = String(rule.id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
  const referral_topic = String(rule.referral_topic || "").trim();
  if (!id || !referral_topic) return null;
  const assigned_to_type = rule.assigned_to_type === "department" ? "department" : "agent";
  if (assigned_to_type === "department") {
    const assigned_department_id = String(rule.assigned_department_id || "").trim();
    if (!assigned_department_id) return null;
    return {
      id,
      referral_topic,
      assigned_to_type: "department",
      assigned_department_id,
      assigned_agent_name: null,
      sort_order: Number(rule.sort_order) || 0,
    };
  }
  const agents = getAgentNamesList();
  const assigned_agent_name = String(rule.assigned_agent_name || agents[0] || "").trim();
  if (!assigned_agent_name) return null;
  return {
    id,
    referral_topic,
    assigned_to_type: "agent",
    assigned_department_id: null,
    assigned_agent_name,
    sort_order: Number(rule.sort_order) || 0,
  };
}

function seedRoutingRules() {
  return DEFAULT_ROUTING_RULES.map((r) => ({ ...r }));
}

function readLocalRoutingRules() {
  if (typeof window === "undefined") return seedRoutingRules();
  try {
    const raw = localStorage.getItem(CRM_ROUTING_RULES_STORAGE_KEY);
    if (!raw) return seedRoutingRules();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return seedRoutingRules();
    const normalized = parsed.map(normalizeRule).filter(Boolean);
    return normalized.length ? normalized : seedRoutingRules();
  } catch {
    return seedRoutingRules();
  }
}

function cacheRulesToLocalStorage(rules) {
  try {
    localStorage.setItem(CRM_ROUTING_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

function readRulesStore() {
  if (isCrmCloudEnabled()) {
    if (!cloudRulesHydrated) return [];
    if (memoryRules) return memoryRules;
    return readLocalRoutingRules();
  }
  if (memoryRules) return memoryRules;
  memoryRules = readLocalRoutingRules();
  return memoryRules;
}

function writeRulesStore(rules) {
  if (typeof window === "undefined") return;
  const sorted = [...rules].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  memoryRules = sorted;
  cacheRulesToLocalStorage(sorted);
  window.dispatchEvent(new CustomEvent(CRM_ROUTING_RULES_CHANGE_EVENT));
  if (isCrmCloudEnabled()) {
    persistRoutingRulesToCloud(sorted).catch((err) => {
      console.warn("[crmRoutingRules] cloud persist failed", err);
    });
  }
}

async function loadRoutingRulesFromCloudOrLocal() {
  if (!isCrmCloudEnabled()) {
    memoryRules = readLocalRoutingRules();
    cloudRulesHydrated = true;
    return memoryRules;
  }
  const local = readLocalRoutingRules();
  try {
    const cloud = await loadRoutingRulesFromCloud();
    if (cloud?.length) {
      memoryRules = cloud;
      cacheRulesToLocalStorage(memoryRules);
      cloudRulesHydrated = true;
      return memoryRules;
    }
    if (local.length) {
      memoryRules = local;
      await persistRoutingRulesToCloud(local);
      cloudRulesHydrated = true;
      return memoryRules;
    }
  } catch (err) {
    console.warn("[crmRoutingRules] cloud load failed", err);
    if (local.length) {
      memoryRules = local;
      cloudRulesHydrated = true;
      return memoryRules;
    }
  }
  memoryRules = seedRoutingRules();
  cacheRulesToLocalStorage(memoryRules);
  cloudRulesHydrated = true;
  return memoryRules;
}

export function hydrateCrmRoutingRules() {
  if (!hydrateRulesPromise) {
    hydrateRulesPromise = loadRoutingRulesFromCloudOrLocal().finally(() => {
      hydrateRulesPromise = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRM_ROUTING_RULES_CHANGE_EVENT));
      }
    });
  }
  return hydrateRulesPromise;
}

export function isCrmRoutingRulesHydrated() {
  if (!isCrmCloudEnabled()) return true;
  return cloudRulesHydrated;
}

export function clearCrmRoutingRulesMemory() {
  memoryRules = null;
  cloudRulesHydrated = false;
  hydrateRulesPromise = null;
}

export function listCrmRoutingRules() {
  return readRulesStore();
}

export function findRoutingRuleForTopic(referralTopic) {
  const topic = String(referralTopic || "").trim();
  if (!topic) return null;
  const rules = readRulesStore();
  return rules.find((r) => r.referral_topic === topic) || null;
}

export function createCrmRoutingRule(rule) {
  const next = normalizeRule(rule);
  if (!next) throw new Error("נושא ושיוך הם שדות חובה");
  const rules = readRulesStore();
  if (rules.some((r) => r.id === next.id)) {
    throw new Error("מזהה כלל כבר קיים");
  }
  if (rules.some((r) => r.referral_topic === next.referral_topic)) {
    throw new Error("כבר קיים כלל לנושא זה");
  }
  const updated = [...rules, { ...next, sort_order: rules.length }];
  writeRulesStore(updated);
  return next;
}

export function updateCrmRoutingRule(id, patch = {}) {
  const rules = readRulesStore();
  let changed = null;
  const updated = rules.map((rule) => {
    if (rule.id !== id) return rule;
    const merged = normalizeRule({
      ...rule,
      ...patch,
      id: patch.id !== undefined ? patch.id : rule.id,
    });
    if (!merged) throw new Error("נתוני כלל לא תקינים");
    changed = merged;
    return merged;
  });
  if (!changed) return null;
  if (updated.some((r) => r.referral_topic === changed.referral_topic && r.id !== changed.id)) {
    throw new Error("כבר קיים כלל לנושא זה");
  }
  writeRulesStore(updated);
  return changed;
}

export function deleteCrmRoutingRule(id) {
  const rules = readRulesStore();
  const updated = rules.filter((rule) => rule.id !== id);
  writeRulesStore(updated);
  if (isCrmCloudEnabled()) {
    deleteRoutingRuleFromCloud(id).catch((err) => {
      console.warn("[crmRoutingRules] cloud delete failed", err);
    });
  }
}

export function subscribeCrmRoutingRules(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CRM_ROUTING_RULES_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CRM_ROUTING_RULES_CHANGE_EVENT, handler);
}
