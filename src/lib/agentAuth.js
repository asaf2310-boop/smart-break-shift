import { supabase, supabaseConfigured } from "@/api/supabase";
import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import {
  findDemoUserByEmail,
  findDemoUserByEmailAny,
  listAllDemoAppUsers,
  setDemoUserPassword,
  verifyDemoUserPassword,
} from "@/lib/appUsersStore";
import { clearAdminSession } from "@/hooks/useIsAdmin";
import { normalizeAgentModules } from "@/constants/agentModules";
import { getAgentNamesList } from "@/constants/scheduling";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import { requestAgentPasswordResetSms } from "@/lib/agentPasswordReset";
import { apiCompleteAgentPasswordSetup, apiRequestFirstLogin } from "@/lib/agentAuthClient";

export const AGENT_SESSION_KEY = "smart-break-agent-session-v1";
export const INVALID_CREDENTIALS_MSG = "אימייל או סיסמה שגויים";
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH_MSG = "הסיסמה חייבת להכיל לפחות 6 תווים";
export const AGENT_AUTH_TIMEOUT_MSG =
  "החיבור לשרת ארך זמן רב מדי — בדוק חיבור אינטרנט ואת הגדרות Supabase ב-Vercel";

const AGENT_PROFILE_COLUMNS =
  "id,email,display_name,auth_user_id,active,blocked,needs_password_setup,deleted_at,phone,modules";

function withAuthTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("agent_auth_timeout")), ms);
    }),
  ]);
}

function mapAuthTimeoutError(err) {
  if (String(err?.message || err) === "agent_auth_timeout") {
    return { ok: false, message: AGENT_AUTH_TIMEOUT_MSG };
  }
  return null;
}

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
  if (lower.includes("invalid") && lower.includes("credentials")) {
    return INVALID_CREDENTIALS_MSG;
  }
  return message;
}

function isInvalidCredentialsError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials") ||
    (msg.includes("invalid") && msg.includes("credential"))
  );
}

function mapSupabaseAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name,
    authUserId: row.auth_user_id,
    needsPasswordSetup: row.needs_password_setup === true,
    phone: row.phone || "",
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
    modules: normalizeAgentModules(row.modules),
  };
}

function mapDemoAgent(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    needsPasswordSetup: user.needsPasswordSetup === true,
    hasStoredPassword: Boolean(user.password),
    phone: user.phone || "",
    active: user.active !== false,
    blocked: user.blocked === true,
    modules: normalizeAgentModules(user.modules),
  };
}

function sessionFromAgent(agent) {
  return {
    userId: agent.id,
    email: agent.email,
    displayName: agent.displayName,
    modules: normalizeAgentModules(agent.modules),
    needsPasswordSetup: agent.needsPasswordSetup === true,
    ...(agent.authUserId ? { authUserId: agent.authUserId } : {}),
  };
}

export function canAgentAuthenticate(agent) {
  return Boolean(agent?.active && !agent?.blocked);
}

/** כניסה ישנה לפי שם בלבד — ללא אימייל/מזהה משתמש */
export function isLegacyAgentSession(session) {
  if (!session?.displayName) return false;
  return !session.email || !session.userId;
}

async function resolveSupabaseAgentById(id) {
  if (!id || !supabase) return null;
  try {
    const { data, error } = await withAuthTimeout(
      supabase.from("agents").select(AGENT_PROFILE_COLUMNS).eq("id", id).maybeSingle()
    );
    if (error) {
      console.warn("[agentAuth] resolveSupabaseAgentById failed", error);
      return null;
    }
    return mapSupabaseAgent(data);
  } catch (err) {
    console.warn("[agentAuth] resolveSupabaseAgentById failed", err);
    return null;
  }
}

async function resolveSupabaseAgentByDisplayName(displayName) {
  const normalized = String(displayName || "").trim();
  if (!normalized || !supabase) return null;
  try {
    const { data, error } = await withAuthTimeout(
      supabase
        .from("agents")
        .select(AGENT_PROFILE_COLUMNS)
        .eq("display_name", normalized)
        .limit(1)
        .maybeSingle()
    );
    if (error) {
      console.warn("[agentAuth] resolveSupabaseAgentByDisplayName failed", error);
      return null;
    }
    return mapSupabaseAgent(data);
  } catch (err) {
    console.warn("[agentAuth] resolveSupabaseAgentByDisplayName failed", err);
    return null;
  }
}

/** מחזיר רשומת נציג לפי הסשן הפעיל */
export async function resolveAgentForSession(session) {
  if (!session) return null;

  if (session.email) {
    return resolveAgentByEmail(session.email);
  }

  if (session.userId) {
    if (demoModeEnabled) {
      const user = listAllDemoAppUsers().find((u) => u.id === session.userId);
      return mapDemoAgent(user);
    }
    return resolveSupabaseAgentById(session.userId);
  }

  if (session.displayName) {
    if (demoModeEnabled) {
      const user = listAllDemoAppUsers().find(
        (u) => String(u.name || "").trim() === String(session.displayName).trim()
      );
      return mapDemoAgent(user);
    }
    return resolveSupabaseAgentByDisplayName(session.displayName);
  }

  return null;
}

/**
 * בודק שהסשן תקף (סיסמה הוגדרה, לא חסום) — אחרת מנתק.
 * מחזיר null אם אין סשן או שנותק.
 */
export async function validateAndRefreshAgentSession() {
  const session = getAgentSession();
  if (!session?.displayName) return null;

  if (isLegacyAgentSession(session)) {
    await agentLogout();
    return null;
  }

  const agent = await resolveAgentForSession(session);
  if (!canAgentAuthenticate(agent)) {
    await agentLogout();
    return null;
  }

  if (agent.needsPasswordSetup) {
    // Client may have cleared the flag before the agents row replicates.
    if (session.needsPasswordSetup === false) {
      return session;
    }
    clearAgentSession();
    return null;
  }

  const refreshed = sessionFromAgent({
    ...agent,
    authUserId: session.authUserId,
  });

  const modulesChanged =
    JSON.stringify(refreshed.modules || []) !== JSON.stringify(session.modules || []);
  const profileChanged =
    refreshed.displayName !== session.displayName || refreshed.email !== session.email;

  if (modulesChanged || profileChanged) {
    setAgentSession(refreshed);
    return refreshed;
  }

  return session;
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
  if (!normalized || !supabase) return null;

  try {
    const { data, error } = await withAuthTimeout(
      supabase
        .from("agents")
        .select(AGENT_PROFILE_COLUMNS)
        .ilike("email", normalized)
        .limit(1)
        .maybeSingle()
    );
    if (error) {
      console.warn("[agentAuth] resolveSupabaseAgentByEmail failed", error);
      return null;
    }
    return mapSupabaseAgent(data);
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

export function agentHasPendingPasswordReset(agent) {
  if (demoModeEnabled) {
    return Boolean(agent?.needsPasswordSetup && agent?.hasStoredPassword);
  }
  return Boolean(agent?.needsPasswordSetup);
}

export async function agentVerifyTemporaryPassword(email, password) {
  const agent = await resolveAgentByEmail(email);
  if (!canAgentAuthenticate(agent) || !agentHasPendingPasswordReset(agent)) {
    return credentialsError();
  }

  if (demoModeEnabled) {
    const user = findDemoUserByEmailAny(email);
    if (!verifyDemoUserPassword(user, password)) {
      return credentialsError();
    }
    return { ok: true };
  }

  if (!supabase) return credentialsError();

  try {
    const { error } = await withAuthTimeout(
      supabase.auth.signInWithPassword({
        email: String(email).trim().toLowerCase(),
        password: String(password),
      })
    );
    if (error) {
      if (isInvalidCredentialsError(error)) return credentialsError();
      return { ok: false, message: mapPasswordAuthError(error.message) };
    }
    return { ok: true };
  } catch (err) {
    return mapAuthTimeoutError(err) || credentialsError();
  }
}

export async function agentLoginWithPassword(email, password) {
  if (demoModeEnabled) {
    const agent = await resolveAgentByEmail(email);
    if (!canAgentAuthenticate(agent)) {
      return credentialsError();
    }
    if (agent.needsPasswordSetup) {
      if (agentHasPendingPasswordReset(agent)) {
        return { ok: false, error: "needs_temp_password", agent };
      }
      return { ok: false, error: "needs_password_setup", agent };
    }
    const user = findDemoUserByEmail(email);
    if (!verifyDemoUserPassword(user, password)) {
      return credentialsError();
    }
    const session = sessionFromAgent(mapDemoAgent(user));
    setAgentSession(session);
    return { ok: true, session };
  }

  if (!supabase) return credentialsError();

  const normalizedEmail = String(email).trim().toLowerCase();
  let data;
  try {
    const result = await withAuthTimeout(
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(password),
      })
    );
    data = result.data;
    if (result.error) {
      if (isInvalidCredentialsError(result.error)) {
        const pending = await resolveSupabaseAgentByEmail(normalizedEmail);
        if (pending?.needsPasswordSetup) {
          return {
            ok: false,
            error: "needs_first_login",
            message: "זו כניסה ראשונה? לחץ «כניסה ראשונה» לקבלת סיסמה זמנית ב-SMS.",
          };
        }
        return credentialsError();
      }
      return { ok: false, message: mapPasswordAuthError(result.error.message) };
    }
  } catch (err) {
    return mapAuthTimeoutError(err) || credentialsError();
  }

  const authUserId = data?.user?.id;
  const refreshedAgent = (await resolveSupabaseAgentByEmail(normalizedEmail)) || null;

  if (!refreshedAgent || !canAgentAuthenticate(refreshedAgent)) {
    await supabase.auth.signOut();
    return credentialsError();
  }

  if (refreshedAgent.needsPasswordSetup) {
    return { ok: false, error: "needs_password_setup", agent: refreshedAgent };
  }

  const session = sessionFromAgent({
    ...refreshedAgent,
    authUserId: authUserId || refreshedAgent.authUserId,
  });
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
    const session = sessionFromAgent(mapDemoAgent(updated));
    setAgentSession(session);
    return { ok: true, session };
  }

  if (!supabase) {
    return { ok: false, message: "Supabase לא מוגדר" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) {
    return { ok: false, message: "נדרשת התחברות לפני הגדרת סיסמה" };
  }

  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password: String(password),
  });
  if (updateError) {
    return { ok: false, message: mapPasswordAuthError(updateError.message) };
  }

  let accessToken = updateData?.session?.access_token || null;
  if (!accessToken) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    accessToken = refreshed?.session?.access_token || null;
  }
  if (!accessToken) {
    const { data: latest } = await supabase.auth.getSession();
    accessToken = latest?.session?.access_token || null;
  }
  if (!accessToken) {
    return { ok: false, message: "נדרשת התחברות לפני הגדרת סיסמה" };
  }

  const complete = await apiCompleteAgentPasswordSetup(accessToken);
  if (!complete.ok) {
    return { ok: false, message: complete.message || "לא הצלחנו לסיים הגדרת סיסמה" };
  }

  const authUserId = updateData?.user?.id || sessionData.session.user.id || agent.authUserId;
  const refreshedAgent = (await resolveAgentByEmail(email)) || agent;
  const session = sessionFromAgent({
    ...refreshedAgent,
    authUserId,
    needsPasswordSetup: false,
  });
  setAgentSession(session);
  return { ok: true, session };
}

export async function agentRequestPasswordReset(email) {
  const agent = await resolveAgentByEmail(email);
  if (!canAgentAuthenticate(agent)) {
    return { ok: true, message: "אם האימייל רשום במערכת ויש טלפון — נשלחה סיסמה זמנית ב-SMS." };
  }

  const phone = normalizeAgentPhone(agent.phone);
  if (!phone && !demoModeEnabled) {
    return {
      ok: false,
      message: "לא הוגדר טלפון לנציג. פנה/י למנהל לעדכון מספר בניהול נציגים.",
    };
  }

  return requestAgentPasswordResetSms(agent);
}

/** כניסה ראשונה — נציג מגדיר סיסמה בעצמו (SMS זמני, בלי שהמנהל הגדיר סיסמה). */
export async function agentRequestFirstLogin(email) {
  if (demoModeEnabled) {
    const agent = await resolveAgentByEmail(email);
    if (!canAgentAuthenticate(agent)) {
      return {
        ok: true,
        message: "אם האימייל רשום במערכת — נשלחה סיסמה זמנית (דמו).",
      };
    }
    if (!agent.needsPasswordSetup && agent.authUserId) {
      return {
        ok: false,
        message: "החשבון כבר הופעל. התחבר/י עם הסיסמה שלך.",
      };
    }
    return requestAgentPasswordResetSms(agent);
  }

  return apiRequestFirstLogin(email);
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
  if (!agent || !canAgentAuthenticate(agent)) {
    await supabase.auth.signOut();
    clearAgentSession();
    return null;
  }

  if (agent.needsPasswordSetup) {
    clearAgentSession();
    return null;
  }

  if (existing?.authUserId === authSession.user.id) {
    return validateAndRefreshAgentSession();
  }

  const session = sessionFromAgent({ ...agent, authUserId: authSession.user.id });
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
