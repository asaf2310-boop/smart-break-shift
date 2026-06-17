import {
  BREAK_AGENT_TODAY_ONLY_MESSAGE,
  BREAK_REGISTRATION_DEADLINE_MESSAGE,
  getIsraelDateStr,
  isBreakRegistrationClosed,
} from "@/constants/scheduling";

/** מנקה רווחים כפולים — מונע "אופיר דוד" מול "אופיר  דוד" */
export function normalizeAgentName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

/** האם הרשמת ההפסקה שייכת לנציג המחובר (כולל שם מקוצר מול שם מלא) */
export function agentOwnsBreakRegistration(registration, agentName) {
  const regName = normalizeAgentName(registration?.agent_name);
  const current = normalizeAgentName(agentName);
  if (!regName || !current) return false;
  if (regName === current) return true;
  return regName.startsWith(`${current} `) || current.startsWith(`${regName} `);
}

export function getBreakLimits(settings) {
  return {
    short: Number(settings?.short_max_per_slot ?? 1),
    lunch: Number(settings?.lunch_max_per_slot ?? 1),
  };
}

/** true when agents cannot register/cancel (deadline passed and no admin override). */
export function isBreakRegistrationBlocked(
  dateStr,
  settings,
  now = new Date(),
  { skipDeadlineCheck = false } = {}
) {
  if (skipDeadlineCheck) return false;
  if (settings?.registration_override_open) return false;
  return isBreakRegistrationClosed(dateStr, now);
}

export function countSlotRegistrations(registrations, timeSlot, breakType) {
  return registrations.filter(
    (r) => r.time_slot === timeSlot && r.break_type === breakType
  ).length;
}

export class BreakRegistrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BreakRegistrationError";
    this.code = code;
  }
}

function sameAgent(a, b) {
  return agentOwnsBreakRegistration({ agent_name: a }, b);
}

export function validateBreakRegistration({
  registrations,
  settings,
  agentName,
  breakType,
  timeSlot,
  date,
  now = new Date(),
  skipDeadlineCheck = false,
  allowNonTodayDate = false,
}) {
  if (date && !allowNonTodayDate && date !== getIsraelDateStr(now)) {
    throw new BreakRegistrationError(
      "NOT_TODAY",
      BREAK_AGENT_TODAY_ONLY_MESSAGE
    );
  }

  if (date && isBreakRegistrationBlocked(date, settings, now, { skipDeadlineCheck })) {
    throw new BreakRegistrationError(
      "REGISTRATION_CLOSED",
      BREAK_REGISTRATION_DEADLINE_MESSAGE
    );
  }

  const limits = getBreakLimits(settings);
  const maxPerSlot = limits[breakType] ?? 1;
  const normalizedName = normalizeAgentName(agentName);

  const agentRegsToday = registrations.filter(
    (r) => r.break_type === breakType && sameAgent(r.agent_name, normalizedName)
  );

  if (agentRegsToday.length > 0) {
    const sameSlot = agentRegsToday.some((r) => r.time_slot === timeSlot);
    throw new BreakRegistrationError(
      "ALREADY_REGISTERED",
      sameSlot
        ? "כבר נרשמת למשבצת הזו"
        : "כבר נרשמת להפסקה מסוג זה להיום"
    );
  }

  const slotCount = countSlotRegistrations(registrations, timeSlot, breakType);
  if (slotCount >= maxPerSlot) {
    throw new BreakRegistrationError(
      "SLOT_FULL",
      "המשבצת מלאה — אין מקום נוסף"
    );
  }

  return { maxPerSlot, slotCount };
}

/** בודק מול נתונים עדכניים מהשרת לפני יצירת הרשמה */
export async function createBreakRegistration(dataClient, payload, options = {}) {
  const normalizedPayload = {
    ...payload,
    agent_name: normalizeAgentName(payload.agent_name),
  };
  const { date, time_slot, break_type, agent_name } = normalizedPayload;

  const [registrations, settingsList] = await Promise.all([
    dataClient.entities.BreakRegistration.filter({ date }),
    dataClient.entities.BreakSettings.filter({ date }),
  ]);

  validateBreakRegistration({
    registrations,
    settings: settingsList[0] || null,
    agentName: agent_name,
    breakType: break_type,
    timeSlot: time_slot,
    date,
    skipDeadlineCheck: options.skipDeadlineCheck ?? false,
    allowNonTodayDate: options.allowNonTodayDate ?? false,
  });

  return dataClient.entities.BreakRegistration.create(normalizedPayload);
}

/** מחיקת הרשמה — בלוח מנהל (Supabase) דרך service role; נציג מוחק את שלו ישירות */
export async function deleteBreakRegistration(dataClient, id, { admin = false } = {}) {
  const registrationId = String(id || "").trim();
  if (!registrationId) {
    throw new BreakRegistrationError("INVALID_ID", "מזהה הרשמה חסר");
  }

  if (admin) {
    const { demoModeEnabled } = await import("@/api/demoClient");
    const { isSupabaseBackend } = await import("@/api/dataClient");
    if (!demoModeEnabled && isSupabaseBackend()) {
      const { apiAdminDeleteBreakRegistration } = await import("@/lib/agentAuthClient");
      await apiAdminDeleteBreakRegistration(registrationId);
      return;
    }
  }

  await dataClient.entities.BreakRegistration.delete(registrationId);
}
