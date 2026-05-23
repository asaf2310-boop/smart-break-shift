/** מנקה רווחים כפולים — מונע "אופיר דוד" מול "אופיר  דוד" */
export function normalizeAgentName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function getBreakLimits(settings) {
  return {
    short: Number(settings?.short_max_per_slot ?? 1),
    lunch: Number(settings?.lunch_max_per_slot ?? 1),
  };
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
  return normalizeAgentName(a) === normalizeAgentName(b);
}

export function validateBreakRegistration({
  registrations,
  settings,
  agentName,
  breakType,
  timeSlot,
}) {
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
export async function createBreakRegistration(dataClient, payload) {
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
  });

  return dataClient.entities.BreakRegistration.create(normalizedPayload);
}
