import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import {
  createDemoAppUser,
  listAllDemoAppUsers,
  normalizeEmail,
  setDemoUserBlocked,
  setDemoUserPasswordByAdmin,
  softDeleteDemoAppUser,
  updateDemoAppUser,
} from "@/lib/appUsersStore";
import { ensureAgentsSeeded } from "@/lib/agentSeed";
import { PASSWORD_MIN_LENGTH } from "@/lib/agentAuth";
import { DEFAULT_AGENT_MODULES, modulesFromPicker } from "@/constants/agentModules";
import { formatCrmRoleLabel, modulesWithCrmRole, normalizeCrmRole } from "@/lib/crmRoles";
import { REAL_AGENT_NAMES } from "@/constants/scheduling";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import { apiAdminSetAgentPassword, apiProvisionAgentAuth, apiLogAdminAgentChange, apiAdminSoftDeleteAgent } from "@/lib/agentAuthClient";
import {
  fetchAgentByIdFromSupabase,
  fetchAgentsFromSupabase,
} from "@/lib/agentsSupabase";

const PENDING_EMAIL_SUFFIX = "@pending.local";

function notifyAgentUsersChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app-users-changed"));
  }
}

function auditAdminAgentChange(agentId, changeType, metadata = {}) {
  if (demoModeEnabled || !agentId) return;
  apiLogAdminAgentChange({ agentId, changeType, metadata });
}

export function isPlaceholderAgentEmail(email) {
  const normalized = normalizeEmail(email);
  return !normalized || normalized.endsWith(PENDING_EMAIL_SUFFIX);
}

function mapSupabaseRow(row) {
  return {
    id: row.id,
    email: row.email || "",
    name: row.display_name,
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
    needsPasswordSetup: row.needs_password_setup === true,
    authUserId: row.auth_user_id,
    modules: Array.isArray(row.modules) ? row.modules : [...DEFAULT_AGENT_MODULES],
    crmRole: normalizeCrmRole(row.crm_role),
    phone: row.phone || "",
  };
}

function mapDemoRow(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active !== false,
    blocked: u.blocked === true,
    needsPasswordSetup: u.needsPasswordSetup === true,
    password: u.password || null,
    modules: Array.isArray(u.modules) ? u.modules : [...DEFAULT_AGENT_MODULES],
    crmRole: normalizeCrmRole(u.crmRole),
    phone: u.phone || "",
  };
}

export async function listManagedAgents() {
  try {
    if (!demoModeEnabled) {
      await ensureAgentsSeeded();
    }

    if (demoModeEnabled) {
      return listAllDemoAppUsers().map(mapDemoRow);
    }

    const rows = await fetchAgentsFromSupabase({ activeOnly: true });
    return rows.map(mapSupabaseRow);
  } catch (err) {
    console.warn("[agentsApi] listManagedAgents failed", err);
    if (String(err?.message || err) === "agents_query_timeout") {
      throw new Error("agents_list_timeout");
    }
    if (demoModeEnabled) {
      try {
        return listAllDemoAppUsers().map(mapDemoRow);
      } catch {
        return [];
      }
    }
    throw err;
  }
}

/** שמות נציגים לכניסה בשם — מהטבלה עם נפילה לרשימה סטטית */
export async function listAgentDisplayNames() {
  try {
    const agents = await listManagedAgents();
    const names = [
      ...new Set(
        agents.map((a) => String(a?.name || "").trim()).filter(Boolean)
      ),
    ];
    if (names.length) {
      return names.sort((a, b) => a.localeCompare(b, "he"));
    }
  } catch (err) {
    console.warn("[agentsApi] listAgentDisplayNames failed", err);
  }
  return [...REAL_AGENT_NAMES];
}

export async function createManagedAgent({ email, name, phone }) {
  const normalized = email ? normalizeEmail(email) : "";
  const displayName = String(name || "").trim();
  if (!displayName) throw new Error("invalid_fields");
  if (normalized && isPlaceholderAgentEmail(normalized)) {
    throw new Error("invalid_fields");
  }

  const phoneValue = phone !== undefined && phone !== "" ? normalizeAgentPhone(phone) || null : null;

  if (demoModeEnabled) {
    if (!normalized) throw new Error("invalid_fields");
    const u = createDemoAppUser({ email: normalized, name: displayName, phone: phoneValue });
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.create({
    email: normalized || null,
    display_name: displayName,
    active: true,
    blocked: false,
    needs_password_setup: true,
    modules: [...DEFAULT_AGENT_MODULES],
    phone: phoneValue,
  });

  if (normalized && !isPlaceholderAgentEmail(normalized)) {
    const provision = await apiProvisionAgentAuth(row.id);
    if (!provision.ok) {
      console.warn("[agentsApi] provision_auth failed", provision.message);
    }
  }

  auditAdminAgentChange(row.id, "create", {
    email: normalized || null,
    name: displayName,
  });

  notifyAgentUsersChanged();
  return mapSupabaseRow(row);
}

export async function updateManagedAgent(id, { email, name, phone }) {
  if (demoModeEnabled) {
    const patch = { email, name };
    if (phone !== undefined) patch.phone = normalizeAgentPhone(phone) || null;
    const u = updateDemoAppUser(id, patch);
    notifyAgentUsersChanged();
    return mapDemoRow(u);
  }

  const payload = {};
  if (email !== undefined) {
    const normalized = normalizeEmail(email);
    payload.email = normalized || null;
  }
  if (name !== undefined) payload.display_name = String(name).trim();
  if (phone !== undefined) {
    payload.phone = normalizeAgentPhone(phone) || null;
  }
  const row = await dataClient.entities.Agent.update(id, payload);
  notifyAgentUsersChanged();
  auditAdminAgentChange(id, "update", {
    fields: Object.keys(payload),
  });
  return mapSupabaseRow(row);
}

/** מנהל בלבד — מגדיר סיסמה ומאלץ הגדרה מחדש בכניסה הבאה */
export async function adminSetManagedAgentPassword(id, password, { forceSetup = true } = {}) {
  const plain = String(password || "");
  if (plain.length < PASSWORD_MIN_LENGTH) {
    throw new Error("password_too_short");
  }

  if (demoModeEnabled) {
    const u = setDemoUserPasswordByAdmin(id, plain, { forceSetup });
    notifyAgentUsersChanged();
    return mapDemoRow(u);
  }

  const result = await apiAdminSetAgentPassword(id, plain, { forceSetup });
  if (!result.ok) {
    throw new Error(result.error || "password_update_failed");
  }

  notifyAgentUsersChanged();
  const row = await fetchAgentByIdFromSupabase(id);
  return mapSupabaseRow(row || { id });
}

export async function setManagedAgentBlocked(id, blocked) {
  if (demoModeEnabled) {
    const u = setDemoUserBlocked(id, blocked);
    notifyAgentUsersChanged();
    return mapDemoRow(u);
  }
  const row = await dataClient.entities.Agent.update(id, { blocked: Boolean(blocked) });
  notifyAgentUsersChanged();
  auditAdminAgentChange(id, blocked ? "block" : "unblock");
  return mapSupabaseRow(row);
}

export async function updateManagedAgentModules(id, modules) {
  const stored = Array.isArray(modules)
    ? modulesFromPicker(modules)
    : [...DEFAULT_AGENT_MODULES];

  if (demoModeEnabled) {
    const u = updateDemoAppUser(id, { modules: stored });
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.update(id, { modules: stored });
  auditAdminAgentChange(id, "modules", { modules: stored });
  return mapSupabaseRow(row);
}

export async function updateManagedAgentCrmRole(id, crmRole) {
  const normalized = normalizeCrmRole(crmRole);

  if (demoModeEnabled) {
    const existing = listAllDemoAppUsers().find((u) => u.id === id);
    const modules = modulesWithCrmRole(existing?.modules, normalized);
    const u = updateDemoAppUser(id, { crmRole: normalized, modules });
    notifyAgentUsersChanged();
    return mapDemoRow(u);
  }

  const existing = await fetchAgentByIdFromSupabase(id);
  const modules = modulesWithCrmRole(existing?.modules, normalized);
  const row = await dataClient.entities.Agent.update(id, {
    crm_role: normalized,
    modules,
  });
  notifyAgentUsersChanged();
  auditAdminAgentChange(id, "crm_role", { crmRole: normalized });
  return mapSupabaseRow(row);
}

export { formatCrmRoleLabel };

export async function deleteManagedAgent(id) {
  if (demoModeEnabled) {
    softDeleteDemoAppUser(id);
    notifyAgentUsersChanged();
    return;
  }

  const result = await apiAdminSoftDeleteAgent(id);
  notifyAgentUsersChanged();
  // Audit is also written server-side; keep client log for older dashboards.
  auditAdminAgentChange(id, "delete", {
    displayName: result?.displayName || null,
    alreadyDeleted: Boolean(result?.alreadyDeleted),
  });
  return result;
}
