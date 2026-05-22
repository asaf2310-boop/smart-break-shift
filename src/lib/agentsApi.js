import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import {
  createDemoAppUser,
  listAllDemoAppUsers,
  normalizeEmail,
  setDemoUserBlocked,
  softDeleteDemoAppUser,
  updateDemoAppUser,
} from "@/lib/appUsersStore";

function mapSupabaseRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
    needsPasswordSetup: row.needs_password_setup,
    authUserId: row.auth_user_id,
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
  };
}

export async function listManagedAgents() {
  if (demoModeEnabled) {
    return listAllDemoAppUsers().map(mapDemoRow);
  }
  const rows = await dataClient.entities.Agent.list("-created_at", 500);
  return (rows || [])
    .filter((r) => r.active !== false && !r.deleted_at)
    .map(mapSupabaseRow);
}

export async function createManagedAgent({ email, name }) {
  const normalized = normalizeEmail(email);
  const displayName = String(name || "").trim();
  if (!normalized || !displayName) throw new Error("invalid_fields");

  if (demoModeEnabled) {
    const u = createDemoAppUser({ email: normalized, name: displayName });
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.create({
    email: normalized,
    display_name: displayName,
    active: true,
    blocked: false,
    needs_password_setup: true,
  });
  return mapSupabaseRow(row);
}

export async function updateManagedAgent(id, { email, name }) {
  if (demoModeEnabled) {
    const u = updateDemoAppUser(id, { email, name });
    return mapDemoRow(u);
  }
  const payload = {};
  if (email !== undefined) payload.email = normalizeEmail(email);
  if (name !== undefined) payload.display_name = String(name).trim();
  const row = await dataClient.entities.Agent.update(id, payload);
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
