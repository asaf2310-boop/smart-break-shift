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

const PENDING_EMAIL_SUFFIX = "@pending.local";

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
    needsPasswordSetup: row.needs_password_setup !== false && !row.password_plain,
    authUserId: row.auth_user_id,
    password: row.password_plain || null,
  };
}

function mapDemoRow(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active !== false,
    blocked: u.blocked === true,
    needsPasswordSetup: u.needsPasswordSetup !== false && !u.password,
    password: u.password || null,
  };
}

export async function listManagedAgents() {
  if (!demoModeEnabled) {
    await ensureAgentsSeeded();
  }

  if (demoModeEnabled) {
    return listAllDemoAppUsers().map(mapDemoRow);
  }

  const rows = await dataClient.entities.Agent.list("-created_at", 500);
  return (rows || [])
    .filter((r) => r.active !== false && !r.deleted_at)
    .map(mapSupabaseRow);
}

export async function createManagedAgent({ email, name }) {
  const normalized = email ? normalizeEmail(email) : "";
  const displayName = String(name || "").trim();
  if (!displayName) throw new Error("invalid_fields");
  if (normalized && isPlaceholderAgentEmail(normalized)) {
    throw new Error("invalid_fields");
  }

  if (demoModeEnabled) {
    if (!normalized) throw new Error("invalid_fields");
    const u = createDemoAppUser({ email: normalized, name: displayName });
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.create({
    email: normalized || null,
    display_name: displayName,
    active: true,
    blocked: false,
    needs_password_setup: true,
    password_plain: null,
  });
  return mapSupabaseRow(row);
}

export async function updateManagedAgent(id, { email, name }) {
  if (demoModeEnabled) {
    const u = updateDemoAppUser(id, { email, name });
    return mapDemoRow(u);
  }

  const payload = {};
  if (email !== undefined) {
    const normalized = normalizeEmail(email);
    payload.email = normalized || null;
  }
  if (name !== undefined) payload.display_name = String(name).trim();
  const row = await dataClient.entities.Agent.update(id, payload);
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
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.update(id, {
    password_plain: plain,
    needs_password_setup: Boolean(forceSetup),
  });
  return mapSupabaseRow(row);
}

export async function setManagedAgentBlocked(id, blocked) {
  if (demoModeEnabled) {
    const u = setDemoUserBlocked(id, blocked);
    return mapDemoRow(u);
  }
  const row = await dataClient.entities.Agent.update(id, { blocked: Boolean(blocked) });
  return mapSupabaseRow(row);
}

export async function deleteManagedAgent(id) {
  if (demoModeEnabled) {
    softDeleteDemoAppUser(id);
    return;
  }
  await dataClient.entities.Agent.update(id, {
    active: false,
    deleted_at: new Date().toISOString(),
  });
}
