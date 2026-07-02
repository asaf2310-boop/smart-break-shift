import { addDays, format, isAfter } from "date-fns";
import { demoModeEnabled } from "@/api/demoClient";
import { listDemoAppUsers } from "@/lib/appUsersStore";
import { getAgentSession } from "@/lib/agentAuth";

export const REAL_AGENT_NAMES = [
  "רחלה מנשה",
  "שרון שפיר",
  "תהילה קיפרווסר",
  "בני סגל",
  "אופיר דוד",
  "אוראל קליפה",
  "הילה שלמה",
  "אורפז דאבוש",
  "בוריס טורבין",
  "נהוראי וקנין",
];

const DEMO_AGENT_NAMES = [
  "נציג 01",
  "נציג 02",
  "נציג 03",
  "נציג 04",
  "נציג 05",
  "נציג 06",
  "נציג 07",
  "נציג 08",
  "נציג 09",
  "נציג 10",
];

export const AGENT_NAMES = demoModeEnabled ? DEMO_AGENT_NAMES : REAL_AGENT_NAMES;

/** כינויים ישנים / שגיאות כתיב → שם קנוני מ-AGENT_NAMES */
const AGENT_NAME_ALIASES = {
  "אוראל כליפה": "אוראל קליפה",
};

/** ממפה שם ממסד/אקסל לשם ברשימת הנציגים (לשיבוץ ואילוצים). */
export function resolveToCanonicalAgentName(name) {
  const normalized = String(name || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  const alias = AGENT_NAME_ALIASES[normalized];
  if (alias) return alias;
  if (AGENT_NAMES.includes(normalized)) return normalized;
  return normalized;
}

/** האם שני שמות מתייחסים לאותו נציג (כולל כינויים / שגיאות כתיב). */
export function agentNamesMatch(a, b) {
  const left = resolveToCanonicalAgentName(a);
  const right = resolveToCanonicalAgentName(b);
  return Boolean(left && right && left === right);
}

/** רשימת שמות נציגים — בדמו מהרשימה שמנהל מגדיר */
export function getAgentNamesList() {
  if (demoModeEnabled) {
    const fromUsers = listDemoAppUsers().map((u) => u.name).filter(Boolean);
    if (fromUsers.length) return fromUsers;
  }
  return AGENT_NAMES;
}

export function getStoredAgentName() {
  if (typeof window === "undefined") return "";

  const session = getAgentSession();
  if (session?.displayName && session?.email && session?.userId) {
    if (!demoModeEnabled && !session.authUserId) {
      return "";
    }
    return session.displayName;
  }

  return "";
}

export const SHORT_BREAK_SLOTS = [
  "10:00-10:10", "10:10-10:20", "10:20-10:30", "10:30-10:40",
  "10:40-10:50", "10:50-11:00", "11:00-11:10", "11:10-11:20",
  "11:20-11:30", "11:30-11:40", "11:40-11:50", "11:50-12:00",
];

export const LUNCH_BREAK_SLOTS = [
  "12:30-13:00", "13:00-13:30", "13:30-14:00",
  "14:00-14:30", "14:30-15:00", "15:00-15:30",
];

/** תאריכי ערב חג (yyyy-MM-dd) — עדכן לפי הצורך */
export const HOLIDAY_EVE_DATES = ["2026-05-21"];

export const WEEKDAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];

export function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Sunday week start for Israel's calendar day (DST-safe). */
export function getWeekStartIsrael(now = new Date()) {
  return getWeekStart(parseDateStrLocal(getIsraelDateStr(now)));
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}

/** Sunday start of the work week where admins publish agent shifts (calendar week + 7). */
export function getPublishedScheduleWeekStart(now = new Date()) {
  return addDays(getWeekStartIsrael(now), 7);
}

/** Sunday of the constraints week agents submit in ShiftScheduler (always next Israel week). */
export function getAgentConstraintsWeekStart(now = new Date()) {
  return addDays(getWeekStartIsrael(now), 7);
}

/**
 * Min/max for agent vacation requests (schedule tab).
 * min = first day of the scheduling week after the latest published schedule.
 */
export function getVacationRequestDateBounds({
  currentDateFrom,
  scheduleDateFrom,
  currentWeekPublished,
  nextWeekPublished,
  lastPublished,
}) {
  const nextWeekStartStr = scheduleDateFrom;
  const weekAfterNextStartStr = formatDateStr(addDays(parseDateStrLocal(scheduleDateFrom), 7));

  let latestPublishedFrom = null;
  if (nextWeekPublished) {
    latestPublishedFrom = nextWeekStartStr;
  } else if (currentWeekPublished) {
    latestPublishedFrom = currentDateFrom;
  }
  if (lastPublished?.dateFrom) {
    if (!latestPublishedFrom || lastPublished.dateFrom > latestPublishedFrom) {
      latestPublishedFrom = lastPublished.dateFrom;
    }
  }

  let minDateStr;
  if (latestPublishedFrom === nextWeekStartStr) {
    minDateStr = weekAfterNextStartStr;
  } else if (latestPublishedFrom === currentDateFrom) {
    minDateStr = nextWeekStartStr;
  } else {
    minDateStr = nextWeekStartStr;
  }

  const maxDateStr = formatDateStr(addDays(parseDateStrLocal(minDateStr), 90));
  return { minDate: minDateStr, maxDate: maxDateStr };
}

/** דד-ליין אילוצים: רביעי 16:00 (שבוע ההגשה — השבוע שלפני שבוע האילוצים) */
export function getConstraintsDeadline(submissionWeekStart) {
  const wednesday = addDays(submissionWeekStart, 3);
  wednesday.setHours(16, 0, 0, 0);
  return wednesday;
}

/** שבוע ההגשה לפי שבוע האילוצים (יום ראשון של שבוע היעד) */
export function getConstraintsSubmissionWeekStart(constraintsWeekStart) {
  return addDays(constraintsWeekStart, -7);
}

export const CONSTRAINTS_SUBMISSION_OVERRIDE_MESSAGE =
  "הגשת אילוצים פתוחה באופן ידני על ידי המנהל — ניתן לערוך גם לאחר הדד-ליין הרגיל.";

export function getConstraintsDeadlineExtendedMessage(deadlineLabel) {
  return `הגשת אילוצים הורחבה עד ${deadlineLabel} על ידי המנהל.`;
}

/**
 * @param {object|null|undefined} weekSettings — ConstraintsWeekSettings row
 * @returns {Date} effective deadline (may be later than default when extended)
 */
export function getEffectiveConstraintsDeadline(submissionWeekStart, weekSettings) {
  const defaultDeadline = getConstraintsDeadline(submissionWeekStart);
  const extendedRaw = weekSettings?.deadline_extended_until;
  if (extendedRaw) {
    const extended = new Date(extendedRaw);
    if (!Number.isNaN(extended.getTime()) && extended > defaultDeadline) {
      return extended;
    }
  }
  return defaultDeadline;
}

/** true when agents cannot submit/edit constraints (unless admin opened override). */
export function isConstraintsSubmissionClosed(
  submissionWeekStart,
  weekSettings,
  now = new Date()
) {
  if (weekSettings?.submission_override_open) return false;
  const deadline = getEffectiveConstraintsDeadline(submissionWeekStart, weekSettings);
  return isAfter(now, deadline);
}

export function formatDateStr(date) {
  return format(date, "yyyy-MM-dd");
}

/** מועד אחרון לרישום/ביטול הפסקות — כל יום עד 10:00 שעון ישראל */
export const BREAK_REGISTRATION_TIMEZONE = "Asia/Jerusalem";
export const BREAK_REGISTRATION_DEADLINE_HOUR = 10;

export const BREAK_REGISTRATION_DEADLINE_MESSAGE =
  "רישום וביטול הפסקות ליום זה נסגרים בשעה 10:00 בבוקר (שעון ישראל). לא ניתן לפעול לאחר המועד.";

export const BREAK_REGISTRATION_OVERRIDE_MESSAGE =
  "רישום הפסקות פתוח באופן ידני על ידי המנהל — ניתן להירשם ולבטל גם לאחר 10:00.";

export function parseDateStrLocal(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** yyyy-MM-dd for the calendar day in Israel (DST-safe). */
export function getIsraelDateStr(now = new Date()) {
  const { year, month, day } = getZonedDateTimeParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Date at local midnight for Israel's calendar today — for labels only. */
export function getTodayIsraelDate(now = new Date()) {
  return parseDateStrLocal(getIsraelDateStr(now));
}

export const BREAK_AGENT_TODAY_ONLY_MESSAGE =
  "ניתן להירשם להפסקות רק ליום הנוכחי (שעון ישראל).";

function getZonedDateTimeParts(date, timeZone = BREAK_REGISTRATION_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** UTC Date for wall-clock time on `dateStr` in Israel (DST-safe). */
export function zonedDateTimeToUtc(
  dateStr,
  hour,
  minute = 0,
  second = 0,
  timeZone = BREAK_REGISTRATION_TIMEZONE
) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);

  let utcMs = Date.UTC(y, m - 1, d, hour, minute, second);
  for (let i = 0; i < 6; i++) {
    const p = getZonedDateTimeParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(y, m - 1, d, hour, minute, second);
    utcMs += want - asUtc;
  }
  return new Date(utcMs);
}

export function getBreakRegistrationDeadline(dateStr) {
  return zonedDateTimeToUtc(
    dateStr,
    BREAK_REGISTRATION_DEADLINE_HOUR,
    0,
    0
  );
}

/** true אחרי 10:00:00 באותו יום (שעון ישראל) — ב-10:00 בדיוק עדיין מותר */
export function isBreakRegistrationClosed(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const deadline = getBreakRegistrationDeadline(dateStr);
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() > deadline.getTime();
}

/** מקסימום ימים לסימון "לא זמין" במשמרת בוקר (08:00–16:00) בשבוע אילוצים */
export const MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK = 4;

/** מקסימום משמרות בוקר (08:00–16:00) לנציג בשיבוץ אוטומטי לשבוע אחד */
export const MAX_MORNING_AUTO_ASSIGNMENTS_PER_WEEK = 2;

export const MORNING_UNAVAILABLE_LIMIT_MESSAGE = `ניתן לסמן משמרת בוקר (08:00–16:00) כלא זמינה לכל היותר ב-${MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK} ימים בשבוע.`;

export function countMorningUnavailableDays(records, dateFrom, dateTo) {
  return records.filter(
    (r) =>
      r.shift_type === "morning" &&
      r.reason === "unavailable" &&
      r.date >= dateFrom &&
      r.date <= dateTo
  ).length;
}

/** @returns {boolean} true if agent may mark this morning slot unavailable */
export function canMarkMorningUnavailable(records, dateFrom, dateTo, dateStr) {
  const alreadyOnDay = records.some(
    (r) =>
      r.date === dateStr &&
      r.shift_type === "morning" &&
      r.reason === "unavailable"
  );
  if (alreadyOnDay) return true;
  return (
    countMorningUnavailableDays(records, dateFrom, dateTo) <
    MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK
  );
}

export const SCHEDULE_DUPLICATE_DAY_MESSAGE =
  "הנציג כבר משובץ באותו יום — לא ניתן לשבץ פעמיים";

export const AUTO_EVENING_SHIFT_RULE_MESSAGE =
  "משמרת 09:00–17:00: כל הנציגים הפעילים שלא חסמו את המשמרת ואין להם חופש מאושר — משובצים אוטומטית";

function normalizeScheduleDate(dateStr) {
  return String(dateStr || "").slice(0, 10);
}

/** true when agent has approved vacation on `dateStr` (VacationRequest). */
export function isAgentOnApprovedVacation(agentName, dateStr, vacationRequests = []) {
  const canonical = resolveToCanonicalAgentName(agentName);
  const normalizedDate = normalizeScheduleDate(dateStr);
  return vacationRequests.some(
    (v) =>
      resolveToCanonicalAgentName(v.agent_name) === canonical &&
      normalizeScheduleDate(v.date) === normalizedDate &&
      v.status === "approved"
  );
}

/** true when agent marked vacation (ShiftUnavailability) for any shift that day. */
export function isAgentOnVacationUnavailability(
  agentName,
  dateStr,
  unavailabilities = []
) {
  const canonical = resolveToCanonicalAgentName(agentName);
  const normalizedDate = normalizeScheduleDate(dateStr);
  return unavailabilities.some(
    (u) =>
      resolveToCanonicalAgentName(u.agent_name) === canonical &&
      normalizeScheduleDate(u.date) === normalizedDate &&
      u.reason === "vacation"
  );
}

/** true when agent has approved vacation or unavailability for `shiftType` on `dateStr`. */
export function isAgentShiftUnavailable(
  agentName,
  dateStr,
  shiftType,
  unavailabilities = [],
  vacationRequests = []
) {
  if (isAgentOnApprovedVacation(agentName, dateStr, vacationRequests)) return true;
  if (isAgentOnVacationUnavailability(agentName, dateStr, unavailabilities)) return true;
  const canonical = resolveToCanonicalAgentName(agentName);
  const normalizedDate = normalizeScheduleDate(dateStr);
  return unavailabilities.some(
    (u) =>
      resolveToCanonicalAgentName(u.agent_name) === canonical &&
      normalizeScheduleDate(u.date) === normalizedDate &&
      u.shift_type === shiftType &&
      u.reason !== "vacation"
  );
}

/** Agents eligible for evening (09:00–17:00) on a given day. */
export function getEligibleEveningShiftAgents(
  dateStr,
  agentPool = AGENT_NAMES,
  blockedAgentNames = new Set(),
  unavailabilities = [],
  vacationRequests = [],
  assignedAgentNames = new Set()
) {
  return agentPool.filter((name) => {
    const canonical = resolveToCanonicalAgentName(name);
    if (blockedAgentNames.has(canonical)) return false;
    if (assignedAgentNames.has(canonical)) return false;
    return !isAgentShiftUnavailable(
      canonical,
      dateStr,
      "evening",
      unavailabilities,
      vacationRequests
    );
  });
}

/** Morning (08:00–16:00): blocked evening but still available for morning. */
export function getEligibleMorningShiftAgents(
  dateStr,
  agentPool = AGENT_NAMES,
  blockedAgentNames = new Set(),
  unavailabilities = [],
  vacationRequests = [],
  assignedAgentNames = new Set()
) {
  return agentPool.filter((name) => {
    const canonical = resolveToCanonicalAgentName(name);
    if (blockedAgentNames.has(canonical)) return false;
    if (assignedAgentNames.has(canonical)) return false;
    if (isAgentOnApprovedVacation(canonical, dateStr, vacationRequests)) return false;
    if (isAgentOnVacationUnavailability(canonical, dateStr, unavailabilities)) return false;
    return (
      isAgentShiftUnavailable(
        canonical,
        dateStr,
        "evening",
        unavailabilities,
        vacationRequests
      ) &&
      !isAgentShiftUnavailable(
        canonical,
        dateStr,
        "morning",
        unavailabilities,
        vacationRequests
      )
    );
  });
}

/** Agents eligible for holiday-eve shift: no vacation and no unavailability that day. */
export function getEligibleHolidayEveShiftAgents(
  dateStr,
  agentPool = AGENT_NAMES,
  blockedAgentNames = new Set(),
  unavailabilities = [],
  vacationRequests = [],
  assignedAgentNames = new Set()
) {
  const normalizedDate = normalizeScheduleDate(dateStr);
  return agentPool.filter((name) => {
    const canonical = resolveToCanonicalAgentName(name);
    if (blockedAgentNames.has(canonical)) return false;
    if (assignedAgentNames.has(canonical)) return false;
    if (isAgentOnApprovedVacation(canonical, dateStr, vacationRequests)) return false;
    if (isAgentOnVacationUnavailability(canonical, dateStr, unavailabilities)) return false;
    return !unavailabilities.some(
      (u) =>
        resolveToCanonicalAgentName(u.agent_name) === canonical &&
        normalizeScheduleDate(u.date) === normalizedDate
    );
  });
}

export const SCHEDULE_VACATION_DAY_MESSAGE =
  "לנציג יש חופש מאושר ביום זה — לא ניתן לשבץ";

export const SCHEDULE_BLOCKED_AGENT_MESSAGE =
  "נציג חסום — לא ניתן לשבץ";

/** @param {{ name: string, blocked?: boolean }[]} managedAgents */
export function getBlockedAgentNames(managedAgents = []) {
  return new Set(
    managedAgents
      .filter((a) => a.blocked === true)
      .map((a) => resolveToCanonicalAgentName(a.name))
      .filter(Boolean)
  );
}

/** Scheduling pool from managed agents; falls back to static list when DB is empty. */
export function getSchedulingAgentPool(managedAgents = [], fallbackPool = AGENT_NAMES) {
  const fromManaged = managedAgents
    .filter((a) => a.active !== false && a.blocked !== true)
    .map((a) => resolveToCanonicalAgentName(String(a.name || "").trim()))
    .filter(Boolean);

  if (fromManaged.length > 0) {
    return [...new Set(fromManaged)].sort((a, b) => a.localeCompare(b, "he"));
  }
  return [...fallbackPool];
}

/** Agents eligible for scheduling / constraints lists (excludes blocked). */
export function getActiveSchedulingAgentNames(managedAgents = [], agentPool) {
  const pool = agentPool ?? getSchedulingAgentPool(managedAgents);
  const blocked = getBlockedAgentNames(managedAgents);
  const names = pool
    .map((name) => resolveToCanonicalAgentName(name))
    .filter((name) => name && !blocked.has(name));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "he"));
}

/** Agents already assigned on `dateStr` in other cells (optional excludeCellKey). */
export function getAgentsAssignedOnDate(assignmentsMap, dateStr, excludeCellKey = null) {
  const assigned = new Set();
  for (const [key, agents] of Object.entries(assignmentsMap || {})) {
    if (!key.startsWith(`${dateStr}|`)) continue;
    if (excludeCellKey && key === excludeCellKey) continue;
    for (const agent of agents || []) {
      assigned.add(resolveToCanonicalAgentName(agent));
    }
  }
  return assigned;
}

/**
 * Agents available to add to a schedule cell (manual assignment picker).
 * Excludes blocked, same-cell, same-day elsewhere, and approved vacation.
 */
export function getAgentsAvailableForScheduleAdd({
  dateStr,
  cellKey,
  cellAgents = [],
  assignmentsMap = {},
  vacationRequests = [],
  blockedAgentNames = new Set(),
  agentPool = AGENT_NAMES,
}) {
  const assignedElsewhereOnDay = getAgentsAssignedOnDate(assignmentsMap, dateStr, cellKey);
  return agentPool.filter((name) => {
    const canonical = resolveToCanonicalAgentName(name);
    if (blockedAgentNames.has(canonical)) return false;
    if (cellAgents.some((a) => resolveToCanonicalAgentName(a) === canonical)) return false;
    if (assignedElsewhereOnDay.has(canonical)) return false;
    if (isAgentOnApprovedVacation(canonical, dateStr, vacationRequests)) return false;
    return true;
  });
}

/** @returns {string|null} Hebrew error message when assignment is invalid */
export function validateScheduleAssignment({
  agentName,
  dateStr,
  cellKey,
  assignmentsMap = {},
  vacationRequests = [],
  blockedAgentNames = new Set(),
}) {
  const canonical = resolveToCanonicalAgentName(agentName);
  if (blockedAgentNames.has(canonical)) return SCHEDULE_BLOCKED_AGENT_MESSAGE;
  if (isAgentOnApprovedVacation(canonical, dateStr, vacationRequests)) {
    return SCHEDULE_VACATION_DAY_MESSAGE;
  }
  const assignedElsewhere = getAgentsAssignedOnDate(assignmentsMap, dateStr, cellKey);
  if (assignedElsewhere.has(canonical)) return SCHEDULE_DUPLICATE_DAY_MESSAGE;
  const cellAgents = assignmentsMap[cellKey] || [];
  if (cellAgents.some((a) => resolveToCanonicalAgentName(a) === canonical)) {
    return SCHEDULE_DUPLICATE_DAY_MESSAGE;
  }
  return null;
}

/** @returns {{ agentName: string, dateStr: string }|null} */
export function findSameDayDuplicateAssignments(assignmentsMap = {}) {
  const dates = new Set(
    Object.keys(assignmentsMap).map((key) => key.split("|")[0]).filter(Boolean)
  );
  for (const dateStr of dates) {
    const seen = new Map();
    for (const [key, agents] of Object.entries(assignmentsMap)) {
      if (!key.startsWith(`${dateStr}|`)) continue;
      for (const agent of agents || []) {
        const canonical = resolveToCanonicalAgentName(agent);
        if (seen.has(canonical)) {
          return { agentName: canonical, dateStr };
        }
        seen.set(canonical, key);
      }
    }
  }
  return null;
}
