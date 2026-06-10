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
import { REAL_AGENT_NAMES } from "@/constants/scheduling";

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
    password: row.password_plain || null,  };
}

function mapDemoRow(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active !== false,
    blocked: u.blocked === true,
    needsPasswordSetup: u.needsPasswordSetup !== false && !u.password,
    password: u.password || null,    const u = createDemoAppUser({ email: normalized, name: displayName });
    return mapDemoRow(u);
  }

  const row = await dataClient.entities.Agent.create({
    email: normalized || null,    display_name: displayName,
    active: true,
    blocked: false,
    needs_password_setup: true,
    password_plain: null,  if (name !== undefined) payload.display_name = String(name).trim();
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

=======
>>>>>>> 842dd9e (Initial commit)
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
