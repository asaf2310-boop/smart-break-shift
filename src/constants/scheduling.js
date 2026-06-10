import { addDays, format, isAfter } from "date-fns";
import { demoModeEnabled } from "@/api/demoClient";
import { listDemoAppUsers } from "@/lib/appUsersStore";
import { getAgentSession } from "@/lib/agentAuth";
import { clearAdminSession, isAdminSessionActive } from "@/hooks/useIsAdmin";

export const REAL_AGENT_NAMES = [
  "רחלה מנשה",
  "שרון שפיר",
  "תהילה קיפרווסר",
  "בני סגל",
  "אופיר דוד",
  "אוראל כליפה",
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
  if (session?.displayName) return session.displayName;

  const storedName = localStorage.getItem("agent_name") || "";
  if (!storedName) return "";

  if (isAdminSessionActive()) {
    clearAdminSession();
  }

  const allowed = getAgentNamesList();
  if (!allowed.includes(storedName)) {
    localStorage.removeItem("agent_name");
    return "";
  }

  return storedName;
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
export const MAX_MORNING_UNAVAILABLE_DAYS_PER_WEEK = 2;

/** מקסימום משמרות בוקר (08:00–16:00) לנציג בשיבוץ אוטומטי לשבוע אחד */
export const MAX_MORNING_AUTO_ASSIGNMENTS_PER_WEEK = 2;

export const MORNING_UNAVAILABLE_LIMIT_MESSAGE =
  "ניתן לסמן משמרת בוקר (08:00–16:00) כלא זמינה לכל היותר ב-2 ימים בשבוע.";

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
