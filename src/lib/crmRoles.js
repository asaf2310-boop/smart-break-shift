/** CRM role values stored on agents.crm_role */
export const CRM_ROLES = {
  NONE: "none",
  USER: "user",
  AGENT: "agent",
  MANAGER: "manager",
};

export const CRM_ROLE_OPTIONS = [
  { value: CRM_ROLES.NONE, label: "ללא גישה" },
  { value: CRM_ROLES.USER, label: "משתמש" },
  { value: CRM_ROLES.AGENT, label: "נציג" },
  { value: CRM_ROLES.MANAGER, label: "מנהל CRM" },
];

const VALID_ROLES = new Set(Object.values(CRM_ROLES));

export function normalizeCrmRole(role) {
  const value = String(role || CRM_ROLES.NONE).trim().toLowerCase();
  return VALID_ROLES.has(value) ? value : CRM_ROLES.NONE;
}

export function formatCrmRoleLabel(role) {
  const normalized = normalizeCrmRole(role);
  return CRM_ROLE_OPTIONS.find((option) => option.value === normalized)?.label || "ללא גישה";
}

/** System admins always get manager-level CRM access. */
export function effectiveCrmRole({ crmRole, isAdmin } = {}) {
  if (isAdmin === true) return CRM_ROLES.MANAGER;
  return normalizeCrmRole(crmRole);
}

export function hasCrmAccess(role) {
  return normalizeCrmRole(role) !== CRM_ROLES.NONE;
}

export function hasCrmAgentDashboard(role) {
  const normalized = normalizeCrmRole(role);
  return normalized === CRM_ROLES.AGENT || normalized === CRM_ROLES.MANAGER;
}

export function hasCrmAdminAccess(role) {
  return normalizeCrmRole(role) === CRM_ROLES.MANAGER;
}

export function hasCrmReportsAccess(role) {
  return hasCrmAdminAccess(role);
}

export function modulesWithCrmRole(modules, crmRole) {
  const list = Array.isArray(modules) ? [...modules] : [];
  if (hasCrmAccess(crmRole) && !list.includes("crm")) {
    list.push("crm");
  }
  return list;
}
