import { demoModeEnabled } from "@/api/demoMode";
import { DEFAULT_AGENT_MODULES, normalizeAgentModules } from "@/constants/agentModules";

export const APP_USERS_STORAGE_KEY = "app-users-v1";

const DEMO_SEED_USERS = [
  { id: "user_demo_01", email: "agent01@demo.local", name: "נציג 01", active: true, blocked: false, needsPasswordSetup: true, password: null, modules: [...DEFAULT_AGENT_MODULES] },
  { id: "user_demo_02", email: "agent02@demo.local", name: "נציג 02", active: true, blocked: false, needsPasswordSetup: true, password: null, modules: [...DEFAULT_AGENT_MODULES] },
  { id: "user_demo_03", email: "agent03@demo.local", name: "נציג 03", active: true, blocked: false, needsPasswordSetup: true, password: null, modules: [...DEFAULT_AGENT_MODULES] },
  { id: "user_demo_04", email: "agent04@demo.local", name: "נציג 04", active: true, blocked: false, needsPasswordSetup: true, password: null, modules: [...DEFAULT_AGENT_MODULES] },
  { id: "user_demo_05", email: "agent05@demo.local", name: "נציג 05", active: true, blocked: false, needsPasswordSetup: true, password: null, modules: [...DEFAULT_AGENT_MODULES] },
];

function makeId() {
  return `user_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isNotDeleted(user) {
  return user.active !== false;
}

function canLogin(user) {
  return isNotDeleted(user) && user.blocked !== true;
}

function readRawUsers() {
  if (!demoModeEnabled || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APP_USERS_STORAGE_KEY);
    if (raw) {
      const users = JSON.parse(raw);
      return users.map((u) => ({
        blocked: false,
        ...u,
        modules: normalizeAgentModules(u.modules),
      }));
    }
  } catch {
    // ignore
  }
  const seed = DEMO_SEED_USERS.map((u) => ({ ...u }));
  localStorage.setItem(APP_USERS_STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function writeRawUsers(users) {
  localStorage.setItem(APP_USERS_STORAGE_KEY, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent("app-users-changed"));
}

/** נציגים פעילים לרשימות שיבוץ (לא חסומים, לא נמחקו) */
export function listDemoAppUsers() {
  return readRawUsers().filter((u) => canLogin(u));
}

/** ניהול מנהל — רק רשומות שלא נמחקו */
export function listAllDemoAppUsers() {
  return readRawUsers().filter(isNotDeleted);
}

/** כניסה — מחזיר רשומה גם אם חסומה/נמחקה (לבדיקת הרשאה) */
export function findDemoUserByEmailAny(email) {
  const normalized = normalizeEmail(email);
  return readRawUsers().find((u) => normalizeEmail(u.email) === normalized) || null;
}

export function findDemoUserByEmail(email) {
  const user = findDemoUserByEmailAny(email);
  return user && canLogin(user) ? user : null;
}

export function findDemoUserById(id) {
  const user = readRawUsers().find((u) => u.id === id);
  return user && isNotDeleted(user) ? user : null;
}

export function createDemoAppUser({ email, name }) {
  const users = readRawUsers();
  const normalized = normalizeEmail(email);
  if (users.some((u) => normalizeEmail(u.email) === normalized && isNotDeleted(u))) {
    throw new Error("email_exists");
  }
  const user = {
    id: makeId(),
    email: normalized,
    name: String(name || "").trim(),
    active: true,
    blocked: false,
    needsPasswordSetup: true,
    password: null,
    modules: [...DEFAULT_AGENT_MODULES],
  };
  users.push(user);
  writeRawUsers(users);
  return user;
}

export function updateDemoAppUser(id, { email, name, active, blocked, modules }) {
  const users = readRawUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) throw new Error("not_found");
  const normalized = email !== undefined ? normalizeEmail(email) : normalizeEmail(users[index].email);
  if (users.some((u) => u.id !== id && isNotDeleted(u) && normalizeEmail(u.email) === normalized)) {
    throw new Error("email_exists");
  }
  const updated = {
    ...users[index],
    ...(email !== undefined ? { email: normalized } : {}),
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(blocked !== undefined ? { blocked: Boolean(blocked) } : {}),
    ...(modules !== undefined ? { modules: normalizeAgentModules(modules) } : {}),
  };
  users[index] = updated;
  writeRawUsers(users);
  return updated;
}

export function softDeleteDemoAppUser(id) {
  return updateDemoAppUser(id, { active: false });
}

export function setDemoUserBlocked(id, blocked) {
  return updateDemoAppUser(id, { blocked: Boolean(blocked) });
}

export function setDemoUserPassword(id, password) {
  const users = readRawUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) throw new Error("not_found");
  users[index] = {
    ...users[index],
    password: String(password),
    needsPasswordSetup: false,
  };
  writeRawUsers(users);
  return users[index];
}

/** מנהל — הגדרת/איפוס סיסמה (גלויה בפאנל ניהול) */
export function setDemoUserPasswordByAdmin(id, password, { forceSetup = true } = {}) {
  const users = readRawUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) throw new Error("not_found");
  users[index] = {
    ...users[index],
    password: String(password),
    needsPasswordSetup: Boolean(forceSetup),
  };
  writeRawUsers(users);
  return users[index];
}

export function verifyDemoUserPassword(user, password) {
  if (!user?.password) return false;
  return user.password === String(password);
}

export function requestDemoPasswordReset(email) {
  const user = findDemoUserByEmail(email);
  if (!user) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    message: `דמו: איפוס סיסמה ל־${user.email} — פנה למנהל.`,
  };
}
