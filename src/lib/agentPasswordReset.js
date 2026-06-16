import { demoModeEnabled } from "@/api/demoClient";
import { PASSWORD_MIN_LENGTH } from "@/lib/agentAuth";
import { sendAgentSms } from "@/lib/agentSms";
import { normalizeAgentPhone } from "@/lib/agentPhone";
import { setDemoUserPasswordByAdmin } from "@/lib/appUsersStore";
import { DEMO_AGENT_PHONES } from "@/constants/agentPhones";
import { apiRequestAgentPasswordReset } from "@/lib/agentAuthClient";

const RESET_COOLDOWN_MS = 2 * 60 * 1000;
const RESET_COOLDOWN_KEY = "agent-password-reset-cooldown-v1";

function readCooldownMap() {
  try {
    const raw = localStorage.getItem(RESET_COOLDOWN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCooldownMap(map) {
  localStorage.setItem(RESET_COOLDOWN_KEY, JSON.stringify(map));
}

function checkResetCooldown(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const map = readCooldownMap();
  const lastAt = map[normalized];
  if (!lastAt) return { allowed: true };
  const elapsed = Date.now() - lastAt;
  if (elapsed >= RESET_COOLDOWN_MS) return { allowed: true };
  const waitSec = Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
  return { allowed: false, waitSec };
}

function markResetCooldown(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const map = readCooldownMap();
  map[normalized] = Date.now();
  writeCooldownMap(map);
}

/** סיסמה זמנית בת 6 ספרות — נוחה ל-SMS */
export function generateTemporaryPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function resolveAgentPhone(agent) {
  const fromRecord = normalizeAgentPhone(agent?.phone);
  if (fromRecord) return fromRecord;

  if (demoModeEnabled && agent?.displayName) {
    const fallback = DEMO_AGENT_PHONES[agent.displayName];
    return normalizeAgentPhone(fallback);
  }

  return "";
}

async function storeTemporaryPasswordDemo(agent, tempPassword) {
  setDemoUserPasswordByAdmin(agent.id, tempPassword, { forceSetup: true });
}

export function buildTemporaryPasswordSmsMessage(tempPassword) {
  return `סיסמה זמנית לכניסה: ${tempPassword}. לאחר הכניסה הגדר סיסמה חדשה.`;
}

const GENERIC_RESET_OK_MSG =
  "אם האימייל רשום במערכת ויש טלפון — נשלחה סיסמה זמנית ב-SMS.";

/**
 * איפוס סיסמה: שומר סיסמה זמנית ושולח ב-SMS.
 * מחזיר הודעה כללית גם כשהאימייל לא קיים (אבטחה).
 */
export async function requestAgentPasswordResetSms(agent) {
  if (!agent?.id || !agent.email) {
    return { ok: true, message: GENERIC_RESET_OK_MSG };
  }

  if (!demoModeEnabled) {
    return apiRequestAgentPasswordReset(agent.email);
  }

  const cooldown = checkResetCooldown(agent.email);
  if (!cooldown.allowed) {
    return {
      ok: false,
      message: `ניתן לבקש איפוס שוב בעוד ${cooldown.waitSec} שניות`,
    };
  }

  const phone = resolveAgentPhone(agent);
  if (!phone) {
    return {
      ok: false,
      message: "לא הוגדר טלפון לנציג. פנה/י למנהל לעדכון מספר בניהול נציגים.",
    };
  }

  const tempPassword = generateTemporaryPassword();
  if (tempPassword.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: "שגיאה ביצירת סיסמה זמנית" };
  }

  try {
    await storeTemporaryPasswordDemo(agent, tempPassword);
  } catch (err) {
    console.warn("[agentPasswordReset] store failed", err);
    return { ok: false, message: "לא הצלחנו לעדכן סיסמה. נסה/י שוב או פנה/י למנהל." };
  }

  const smsMessage = buildTemporaryPasswordSmsMessage(tempPassword);
  const smsResult = await sendAgentSms({
    phone,
    message: smsMessage,
    agentName: agent.displayName,
  });

  if (!smsResult.ok) {
    return {
      ok: false,
      message: smsResult.message || "שליחת SMS נכשלה. נסה/י שוב או פנה/י למנהל.",
    };
  }

  markResetCooldown(agent.email);

  return {
    ok: true,
    message: `דמו: הסיסמה הזמנית היא ${tempPassword} (בפרודקשן נשלחת ב-SMS בלבד). לאחר הכניסה הגדר סיסמה חדשה.`,
    demoPassword: tempPassword,
  };
}
