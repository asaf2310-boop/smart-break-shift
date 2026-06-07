import { supabase, supabaseConfigured } from "@/api/supabase";
import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import {
  findDemoUserByEmail,
  findDemoUserByEmailAny,
  setDemoUserPassword,
  verifyDemoUserPassword,
  requestDemoPasswordReset,
} from "@/lib/appUsersStore";
import { clearAdminSession } from "@/hooks/useIsAdmin";
import { getAgentNamesList } from "@/constants/scheduling";

export const AGENT_SESSION_KEY = "smart-break-agent-session-v1";
export const INVALID_CREDENTIALS_MSG = "אימייל או סיסמה שגויים";
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH_MSG = "הסיסמה חייבת להכיל לפחות 6 תווים";

/** HTML5 minLength shows English in many browsers; override with Hebrew. */
export function passwordMinLengthInputProps() {
  return {
    minLength: PASSWORD_MIN_LENGTH,
    onInvalid: (e) => {
      if (e.target.validity.tooShort) {
        e.target.setCustomValidity(PASSWORD_MIN_LENGTH_MSG);
      }
    },
    onInput: (e) => {
      e.target.setCustomValidity("");
    },
  };
}

function mapPasswordAuthError(message) {
  if (!message) return PASSWORD_MIN_LENGTH_MSG;
  const lower = String(message).toLowerCase();
  if (
    lower.includes("6") &&
    (lower.includes("character") || lower.includes("password") || lower.includes("weak"))
  ) {
    return PASSWORD_MIN_LENGTH_MSG;
  }
  return message;
}

function mapSupabaseAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name,
    authUserId: row.auth_user_id,
    needsPasswordSetup: row.needs_password_setup !== false && !row.password_plain,
    passwordPlain: row.password_plain || null,
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
  };
}

function mapDemoAgent(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    needsPasswordSetup: user.needsPasswordSetup !== false && !user.password,
    active: user.active !== false,
    blocked: user.blocked === true,
  };
}

export function canAgentAuthenticate(agent) {
  return Boolean(agent?.active && !agent?.blocked);
}

export function getAgentSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AGENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAgentSession(session) {
  clearAdminSession();
  localStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("agent_name", session.displayName);
  window.dispatchEvent(new CustomEvent("agent-session-changed"));
}

export function clearAgentSession() {
  clearAdminSession();
  localStorage.removeItem(AGENT_SESSION_KEY);
  localStorage.removeItem("agent_name");
  window.dispatchEvent(new CustomEvent("agent-session-changed"));
}

/** Dev/demo: clear persisted agent login so the login screen shows again. */
export const clearLogout = clearAgentSession;

async function resolveSupabaseAgentByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!supabaseConfigured || !dataClient.entities.Agent?.list) return null;

  try {
    const all = await dataClient.entities.Agent.list("-created_at", 500);
    const match = (all || []).find(
      (r) => String(r.email || "").trim().toLowerCase() === normalized
    );
    return mapSupabaseAgent(match);
  } catch (err) {
    console.warn("[agentAuth] resolveSupabaseAgentByEmail failed", err);
    return null;
  }
}

/** נציג עם אימייל אמיתי (לא placeholder) — לכניסה בהיברידי */
export function agentHasEmailLogin(agent) {
  const email = String(agent?.email || "").trim().toLowerCase();
  return Boolean(email) && !email.endsWith("@pending.local");
}

/** מחזיר רשומה לפי אימייל (כולל חסום/מחוק) */
export async function resolveAgentByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  if (demoModeEnabled) {
    return mapDemoAgent(findDemoUserByEmailAny(normalized));
  }
  return resolveSupabaseAgentByEmail(normalized);
}

export async function lookupAgentByEmail(email) {
  const agent = await resolveAgentByEmail(email);
  return canAgentAuthenticate(agent) ? agent : null;
}

function credentialsError() {
  return { ok: false, error: "invalid_credentials", message: INVALID_CREDENTIALS_MSG };
}

/** כניסת נציג בפרודקשן — בחירת שם בלבד (ללא אימייל) */
export function agentLoginByDisplayName(displayName) {
  const name = String(displayName || "").trim();
  const allowed = getAgentNamesList();
  if (!name || !allowed.includes(name)) {
    return { ok: false, message: "יש לבחור שם מהרשימה" };
  }
  const session = { displayName: name };
  setAgentSession(session);
  return { ok: true, session };
}

function verifySupabaseAgentPassword(agent, password) {
  if (!agent?.passwordPlain) return false;
  return agent.passwordPlain === String(password);
}

export async function agentLoginWithPassword(email, password) {
  const agent = await resolveAgentByEmail(email);
  if (!canAgentAuthenticate(agent)) {
    return credentialsError();
  }
  if (agent.needsPasswordSetup) {
    return { ok: false, error: "needs_password_setup", agent };
  }

  if (demoModeEnabled) {
    const user = findDemoUserByEmail(email);
    if (!verifyDemoUserPassword(user, password)) {
      return credentialsError();
    }
    const session = { userId: user.id, email: user.email, displayName: user.name };
    setAgentSession(session);
    return { ok: true, session };
  }

  if (!verifySupabaseAgentPassword(agent, password)) {
    return credentialsError();
  }

  const session = {
    userId: agent.id,
    email: agent.email,
    displayName: agent.displayName,
  };
  setAgentSession(session);
  return { ok: true, session };
}

export async function agentSetupPassword(email, password) {
  if (String(password).length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: PASSWORD_MIN_LENGTH_MSG };
  }

  const agent = await resolveAgentByEmail(email);
  if (!canAgentAuthenticate(agent)) {
    return credentialsError();
  }

  if (demoModeEnabled) {
    const updated = setDemoUserPassword(agent.id, password);
    const session = { userId: updated.id, email: updated.email, displayName: updated.name };
    setAgentSession(session);
    return { ok: true, session };
  }

  if (!dataClient.entities.Agent?.update) {
    return credentialsError();
  }

  // SECURITY: password stored plaintext for admin visibility — see agents_password_migration.sql
  await dataClient.entities.Agent.update(agent.id, {
    password_plain: String(password),
    needs_password_setup: false,
  });

  const session = {
    userId: agent.id,
    email: agent.email,
    displayName: agent.displayName,
  };
  setAgentSession(session);
  return { ok: true, session };
}

export async function agentRequestPasswordReset(email) {
  if (!demoModeEnabled) {
    const agent = await resolveAgentByEmail(email);
    if (!canAgentAuthenticate(agent)) {
      return { ok: false, message: "אם האימייל ברשימה, פנה/י למנהל המערכת." };
    }
    return { ok: true, message: "איפוס סיסמה מתבצע דרך מנהל המערכת בלבד." };
  }

  const agent = await resolveAgentByEmail(email);
  if (!canAgentAuthenticate(agent)) {
    return { ok: false, message: "אם האימייל ברשימה, נשלח קישור לאיפוס. בדוק את תיבת הדואר." };
  }

  if (demoModeEnabled) {
    const result = requestDemoPasswordReset(email);
    return { ok: true, message: result.message };
  }

  if (!supabase) {
    return { ok: false, message: "Supabase לא מוגדר" };
  }

  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(agent.email, { redirectTo });
  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    message: "נשלח קישור לאיפוס סיסמה (אם SMTP מוגדר ב-Supabase). בדוק את תיבת הדואר.",
  };
}

export async function agentLogout() {
  clearAgentSession();
  if (!demoModeEnabled && supabase) {
    await supabase.auth.signOut();
  }
}

export async function restoreSupabaseAgentSession() {
  if (demoModeEnabled || !supabase) return getAgentSession();

  const existing = getAgentSession();
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession?.user) {
    if (existing) clearAgentSession();
    return null;
  }

  const email = authSession.user.email;
  const agent = await lookupAgentByEmail(email);
  if (!agent) {
    await supabase.auth.signOut();
    clearAgentSession();
    return null;
  }

  if (existing?.authUserId === authSession.user.id) {
    return existing;
  }

  const session = {
    userId: agent.id,
    email: agent.email,
    displayName: agent.displayName,
    authUserId: authSession.user.id,
  };
  setAgentSession(session);
  return session;
}

export async function completePasswordReset(newPassword) {
  if (!supabase) return { ok: false, message: "Supabase לא מוגדר" };
  if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: PASSWORD_MIN_LENGTH_MSG };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: mapPasswordAuthError(error.message) };
  return { ok: true, message: "הסיסמה עודכנה. אפשר להתחבר." };
}
