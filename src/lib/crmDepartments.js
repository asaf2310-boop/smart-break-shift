import { getAgentNamesList } from "@/constants/scheduling";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import {
  deleteDepartmentFromCloud,
  loadDepartmentsFromCloud,
  persistDepartmentsToCloud,
} from "@/lib/crmCloudSync";

const CRM_DEPARTMENTS_STORAGE_KEY = "smart-break-shift-crm-departments-v1";
const CRM_DEPARTMENTS_CHANGE_EVENT = "crm-departments-changed";

const DEFAULT_DEPARTMENTS = [
  { id: "service", name: "שירות", agentNames: [] },
  { id: "billing", name: "חשבוניות", agentNames: ["נציג 03", "נציג 05", "נציג 08"] },
  { id: "sales", name: "מכירות", agentNames: ["נציג 01", "נציג 04"] },
  { id: "support", name: "תמיכה", agentNames: ["נציג 06", "נציג 07", "נציג 09"] },
];

let memoryDepartments = null;
let hydrateDepartmentsPromise = null;
let cloudDepartmentsHydrated = false;

function normalizeDepartment(dept) {
  if (!dept) return null;
  const id = String(dept.id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
  const name = String(dept.name || "").trim();
  if (!id || !name) return null;
  const agentNames = Array.isArray(dept.agentNames)
    ? [...new Set(dept.agentNames.map((n) => String(n || "").trim()).filter(Boolean))]
    : [];
  return { id, name, agentNames };
}

function seedDepartments() {
  const allAgents = getAgentNamesList();
  return DEFAULT_DEPARTMENTS.map((dept) => {
    if (dept.id !== "service") return { ...dept };
    return { ...dept, agentNames: [...allAgents] };
  });
}

function readLocalDepartments() {
  if (typeof window === "undefined") return seedDepartments();
  try {
    const raw = localStorage.getItem(CRM_DEPARTMENTS_STORAGE_KEY);
    if (!raw) return seedDepartments();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return seedDepartments();
    const normalized = parsed.map(normalizeDepartment).filter(Boolean);
    return normalized.length ? normalized : seedDepartments();
  } catch {
    return seedDepartments();
  }
}

function cacheDepartmentsToLocalStorage(departments) {
  try {
    localStorage.setItem(CRM_DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
  } catch {
    // ignore
  }
}

function readDepartmentsStore() {
  if (isCrmCloudEnabled()) {
    if (!cloudDepartmentsHydrated) return [];
    if (memoryDepartments) return memoryDepartments;
    return readLocalDepartments();
  }
  if (memoryDepartments) return memoryDepartments;
  const local = readLocalDepartments();
  memoryDepartments = local;
  return memoryDepartments;
}

function writeDepartmentsStore(departments) {
  if (typeof window === "undefined") return;
  memoryDepartments = departments.map(normalizeDepartment).filter(Boolean);
  cacheDepartmentsToLocalStorage(memoryDepartments);
  window.dispatchEvent(new CustomEvent(CRM_DEPARTMENTS_CHANGE_EVENT));
  if (isCrmCloudEnabled()) {
    persistDepartmentsToCloud(memoryDepartments).catch((err) => {
      console.warn("[crmDepartments] cloud persist failed", err);
    });
  }
}

function departmentsHaveMembers(departments) {
  return (departments || []).some((d) => d.agentNames?.length > 0);
}

async function loadDepartmentsFromCloudOrMigrate() {
  if (!isCrmCloudEnabled()) {
    memoryDepartments = readLocalDepartments();
    cloudDepartmentsHydrated = true;
    return memoryDepartments;
  }

  const local = readLocalDepartments();

  try {
    const cloud = await loadDepartmentsFromCloud();
    if (cloud?.length) {
      if (!departmentsHaveMembers(cloud) && departmentsHaveMembers(local)) {
        memoryDepartments = local;
        cacheDepartmentsToLocalStorage(memoryDepartments);
        await persistDepartmentsToCloud(local);
        cloudDepartmentsHydrated = true;
        return memoryDepartments;
      }
      memoryDepartments = cloud;
      cacheDepartmentsToLocalStorage(memoryDepartments);
      cloudDepartmentsHydrated = true;
      return memoryDepartments;
    }

    if (local?.length) {
      memoryDepartments = local;
      cacheDepartmentsToLocalStorage(memoryDepartments);
      await persistDepartmentsToCloud(local);
      cloudDepartmentsHydrated = true;
      return memoryDepartments;
    }
  } catch (err) {
    console.warn("[crmDepartments] cloud load failed", err);
    if (local?.length) {
      memoryDepartments = local;
      cacheDepartmentsToLocalStorage(memoryDepartments);
      cloudDepartmentsHydrated = true;
      return memoryDepartments;
    }
  }

  memoryDepartments = seedDepartments();
  cacheDepartmentsToLocalStorage(memoryDepartments);
  cloudDepartmentsHydrated = true;
  return memoryDepartments;
}

/** נקרא מ-hydrateCrmStore */
export function hydrateCrmDepartments() {
  if (!hydrateDepartmentsPromise) {
    hydrateDepartmentsPromise = loadDepartmentsFromCloudOrMigrate().finally(() => {
      hydrateDepartmentsPromise = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRM_DEPARTMENTS_CHANGE_EVENT));
      }
    });
  }
  return hydrateDepartmentsPromise;
}

export function resetCrmDepartmentsForRehydrate() {
  memoryDepartments = null;
  cloudDepartmentsHydrated = false;
  hydrateDepartmentsPromise = null;
}

/** איפוס זיכרון לפני hydrate מחדש (Realtime) */
export function clearCrmDepartmentsMemory() {
  resetCrmDepartmentsForRehydrate();
}

export function invalidateCrmDepartmentsCache() {
  resetCrmDepartmentsForRehydrate();
  return hydrateCrmDepartments();
}

export function isCrmDepartmentsHydrated() {
  return !isCrmCloudEnabled() || cloudDepartmentsHydrated;
}

export function listCrmDepartments() {
  return readDepartmentsStore().sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export const CRM_DEPARTMENTS = listCrmDepartments();

export function createCrmDepartment({ id, name }) {
  const next = normalizeDepartment({ id, name, agentNames: [] });
  if (!next) throw new Error("שם מחלקה ומזהה הם שדות חובה");
  const departments = readDepartmentsStore();
  if (departments.some((d) => d.id === next.id)) {
    throw new Error("מזהה מחלקה כבר קיים");
  }
  const updated = [...departments, next];
  writeDepartmentsStore(updated);
  return next;
}

export function updateCrmDepartment(id, patch = {}) {
  const departments = readDepartmentsStore();
  let changed = null;
  const updated = departments.map((dept) => {
    if (dept.id !== id) return dept;
    const merged = normalizeDepartment({
      ...dept,
      ...patch,
      id: patch.id !== undefined ? patch.id : dept.id,
      agentNames: patch.agentNames !== undefined ? patch.agentNames : dept.agentNames,
    });
    if (!merged) throw new Error("נתוני מחלקה לא תקינים");
    changed = merged;
    return merged;
  });
  if (!changed) return null;
  if (updated.some((d) => d.id === changed.id && d !== changed)) {
    throw new Error("מזהה מחלקה כבר קיים");
  }
  writeDepartmentsStore(updated);
  return changed;
}

export function deleteCrmDepartment(id) {
  const departments = readDepartmentsStore();
  const updated = departments.filter((dept) => dept.id !== id);
  writeDepartmentsStore(updated);
  if (isCrmCloudEnabled()) {
    deleteDepartmentFromCloud(id).catch((err) => {
      console.warn("[crmDepartments] cloud delete failed", err);
    });
  }
}

export function setDepartmentAgentNames(id, agentNames = []) {
  return updateCrmDepartment(id, { agentNames });
}

export function getDepartmentById(id) {
  return readDepartmentsStore().find((d) => d.id === id) || null;
}

export function getDepartmentsForAgent(agentName) {
  const name = String(agentName || "").trim();
  if (!name) return [];
  return readDepartmentsStore().filter((dept) => dept.agentNames.includes(name));
}

export function isAgentInDepartment(agentName, departmentId) {
  const dept = getDepartmentById(departmentId);
  if (!dept) return false;
  return dept.agentNames.includes(String(agentName || "").trim());
}

export function getDepartmentName(departmentId) {
  return getDepartmentById(departmentId)?.name || departmentId;
}

export function subscribeCrmDepartments(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CRM_DEPARTMENTS_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CRM_DEPARTMENTS_CHANGE_EVENT, handler);
}
