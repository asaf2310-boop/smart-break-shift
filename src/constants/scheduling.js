import { addDays, format } from "date-fns";
import { demoModeEnabled } from "@/api/demoClient";
import { listDemoAppUsers } from "@/lib/appUsersStore";
import { getAgentSession } from "@/lib/agentAuth";

const REAL_AGENT_NAMES = [
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

export const AGENT_NAMES = import.meta.env.VITE_DEMO_MODE === "true" ? DEMO_AGENT_NAMES : REAL_AGENT_NAMES;

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

export function getWeekDays(weekStart) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}

/** דד-ליין אילוצים: רביעי 16:00 */
export function getConstraintsDeadline(weekStart) {
  const wednesday = addDays(weekStart, 3);
  wednesday.setHours(16, 0, 0, 0);
  return wednesday;
}

export function formatDateStr(date) {
  return format(date, "yyyy-MM-dd");
}
