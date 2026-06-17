import {
  adminUpdateAgentPassword,
  getAgentByEmail,
  markAgentNeedsPasswordSetup,
  provisionAuthUserForAgent,
  resolveAgentAuthUser,
  agentRequiresFirstLogin,
} from "./agentAuthService.js";
import { normalizeIsraeliPhone, sendInforuSms } from "../../api/send-schedule-sms.js";

const RESET_COOLDOWN_MS = 2 * 60 * 1000;
const cooldownByEmail = new Map();

const GENERIC_RESET_OK_MSG =
  "אם האימייל רשום במערכת ויש טלפון — נשלחה סיסמה זמנית ב-SMS.";

const PASSWORD_MIN_LENGTH = 12;

export function generateTemporaryPassword() {
  return `${Math.floor(100000 + Math.random() * 900000)}${Math.floor(100000 + Math.random() * 900000)}`;
}

export function buildTemporaryPasswordSmsMessage(tempPassword) {
  return `סיסמה זמנית לכניסה: ${tempPassword}. לאחר הכניסה הגדר סיסמה חדשה.`;
}

function checkResetCooldown(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const lastAt = cooldownByEmail.get(normalized);
  if (!lastAt) return { allowed: true };
  const elapsed = Date.now() - lastAt;
  if (elapsed >= RESET_COOLDOWN_MS) return { allowed: true };
  const waitSec = Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
  return { allowed: false, waitSec };
}

function markResetCooldown(email) {
  const normalized = String(email || "").trim().toLowerCase();
  cooldownByEmail.set(normalized, Date.now());
}

function getInforuConfig() {
  return {
    userName: String(process.env.INFORU_USERNAME || "").trim(),
    apiToken: String(process.env.INFORU_API_TOKEN || "").trim(),
    sender: String(process.env.INFORU_SENDER || "").trim(),
  };
}

/**
 * Server-side password reset: set Auth password + SMS temp password.
 * Always returns generic success when email not found / inactive (security).
 */
export async function requestPasswordResetByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return { ok: true, message: GENERIC_RESET_OK_MSG };
  }

  const agent = await getAgentByEmail(normalized);
  if (!agent || !agent.active || agent.blocked) {
    return { ok: true, message: GENERIC_RESET_OK_MSG };
  }

  const cooldown = checkResetCooldown(normalized);
  if (!cooldown.allowed) {
    return {
      ok: false,
      message: `ניתן לבקש איפוס שוב בעוד ${cooldown.waitSec} שניות`,
    };
  }

  const phone = normalizeIsraeliPhone(agent.phone);
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
    const provisioned = await provisionAuthUserForAgent(agent, tempPassword);
    await adminUpdateAgentPassword(provisioned.authUserId, tempPassword);
    await markAgentNeedsPasswordSetup(agent.id);
  } catch (err) {
    console.warn("[agentPasswordResetService] auth update failed", err);
    return { ok: false, message: "לא הצלחנו לעדכן סיסמה. נסה/י שוב או פנה/י למנהל." };
  }

  const { userName, apiToken, sender } = getInforuConfig();
  if (!userName || !apiToken || !sender) {
    return {
      ok: false,
      message: "שירות SMS לא מוגדר",
    };
  }

  const smsMessage = buildTemporaryPasswordSmsMessage(tempPassword);
  const smsResult = await sendInforuSms({
    userName,
    apiToken,
    sender,
    to: phone,
    message: smsMessage,
  });

  if (!smsResult.ok) {
    return {
      ok: false,
      message: smsResult.message || "שליחת SMS נכשלה. נסה/י שוב או פנה/י למנהל.",
    };
  }

  markResetCooldown(normalized);

  return {
    ok: true,
    message: "נשלחה סיסמה זמנית ב-SMS. הזן/י אותה בכניסה ולאחר מכן בחר/י סיסמה חדשה.",
  };
}

const GENERIC_FIRST_LOGIN_OK_MSG =
  "אם האימייל רשום במערכת ויש טלפון — נשלחה סיסמה זמנית ב-SMS לכניסה ראשונה.";

/**
 * כניסה ראשונה — רק לנציגים עם needs_password_setup.
 * שולח SMS זמני (אותה לוגיקה כאיפוס) בלי שהמנהל הגדיר סיסמה.
 */
export async function requestFirstLoginByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return { ok: true, message: GENERIC_FIRST_LOGIN_OK_MSG };
  }

  const agent = await getAgentByEmail(normalized);
  if (!agent || !agent.active || agent.blocked) {
    return { ok: true, message: GENERIC_FIRST_LOGIN_OK_MSG };
  }

  const authState = await resolveAgentAuthUser(agent);

  if (!agentRequiresFirstLogin(agent, authState)) {
    return {
      ok: false,
      message: "החשבון כבר הופעל. התחבר/י עם הסיסמה שלך או «שכחתי סיסמה».",
    };
  }

  await markAgentNeedsPasswordSetup(agent.id);

  const agentForProvision = { ...agent, authUserId: authState.authUserId };

  if (!authState.exists) {
    try {
      const temp = generateTemporaryPassword();
      await provisionAuthUserForAgent(agentForProvision, temp);
    } catch (err) {
      console.warn("[agentPasswordResetService] first login provision failed", err);
      return { ok: false, message: "לא הצלחנו להכין חשבון. פנה/י למנהל." };
    }
  }

  const result = await requestPasswordResetByEmail(normalized);
  if (result.ok) {
    return {
      ok: true,
      message:
        "נשלחה סיסמה זמנית ב-SMS לכניסה ראשונה. הזן/י אותה ולאחר מכן בחר/י סיסמה אישית.",
    };
  }
  return result;
}
