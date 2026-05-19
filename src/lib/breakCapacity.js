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

export function validateBreakRegistration({
  registrations,
  settings,
  agentName,
  breakType,
  timeSlot,
}) {
  const limits = getBreakLimits(settings);
  const maxPerSlot = limits[breakType] ?? 1;

  const alreadyRegistered = registrations.some(
    (r) => r.agent_name === agentName && r.break_type === breakType
  );
  if (alreadyRegistered) {
    throw new BreakRegistrationError(
      "ALREADY_REGISTERED",
      "כבר נרשמת להפסקה מסוג זה להיום"
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
  const { date, time_slot, break_type, agent_name } = payload;

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

  return dataClient.entities.BreakRegistration.create(payload);
}
