import { format } from "date-fns";

import { dataClient } from "@/api/client";



export const LAST_PUBLISHED_SCHEDULE_KEY = "shift-schedule-last-published";



export function getScheduleCacheKey(dateFrom, dateTo) {

  return `shift-schedule-cache:${dateFrom}:${dateTo}`;

}



export function filterRegistrationsForWeek(rows, dateFrom, dateTo) {

  if (!Array.isArray(rows)) return [];

  return rows.filter(

    (row) =>

      row?.date &&

      row.date >= dateFrom &&

      row.date <= dateTo

  );

}



export function readCachedSchedule(dateFrom, dateTo) {

  try {

    const raw = sessionStorage.getItem(getScheduleCacheKey(dateFrom, dateTo));

    const parsed = raw ? JSON.parse(raw) : undefined;

    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;

    const inRange = filterRegistrationsForWeek(parsed, dateFrom, dateTo);

    return inRange.length > 0 ? inRange : undefined;

  } catch {

    return undefined;

  }

}



export function writeCachedSchedule(dateFrom, dateTo, data) {

  const inRange = filterRegistrationsForWeek(data, dateFrom, dateTo);

  if (inRange.length === 0) return;

  try {

    sessionStorage.setItem(getScheduleCacheKey(dateFrom, dateTo), JSON.stringify(inRange));

  } catch {

    // Cache is only a speed boost; ignore browsers that block storage.

  }

}



export function clearCachedSchedule(dateFrom, dateTo) {

  try {

    sessionStorage.removeItem(getScheduleCacheKey(dateFrom, dateTo));

  } catch {

    // ignore

  }

}



/** Clears all agent schedule session caches (after admin publish / realtime). */

export function clearAllScheduleCaches() {

  try {

    const keysToRemove = [];

    for (let i = 0; i < sessionStorage.length; i++) {

      const key = sessionStorage.key(i);

      if (key?.startsWith("shift-schedule-cache:")) keysToRemove.push(key);

    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));

  } catch {

    // ignore

  }

}



export function markLastPublishedScheduleWeek(dateFrom, dateTo) {

  const payload = JSON.stringify({ dateFrom, dateTo, at: Date.now() });

  try {

    localStorage.setItem(LAST_PUBLISHED_SCHEDULE_KEY, payload);

  } catch {

    // ignore

  }

  try {

    sessionStorage.setItem(LAST_PUBLISHED_SCHEDULE_KEY, payload);

  } catch {

    // ignore

  }

}



export function readLastPublishedScheduleWeek() {

  try {

    const raw =

      localStorage.getItem(LAST_PUBLISHED_SCHEDULE_KEY) ||

      sessionStorage.getItem(LAST_PUBLISHED_SCHEDULE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.dateFrom || !parsed?.dateTo) return null;

    return parsed;

  } catch {

    return null;

  }

}



/** Agent schedule tab: one primary week; hide stale calendar week when operative week is published. */

export function resolveAgentSchedulePanels({

  currentPanel,

  nextPanel,

  lastPublished,

}) {

  const nextHas = nextPanel.scheduleRegistrations.length > 0;

  const currentHas = currentPanel.scheduleRegistrations.length > 0;

  const sortByPublishedFocus = (panels) => {

    const lastFrom = lastPublished?.dateFrom;

    if (!lastFrom) return panels;

    return [...panels].sort((a, b) => {

      if (a.dateFrom === lastFrom && b.dateFrom !== lastFrom) return -1;

      if (b.dateFrom === lastFrom && a.dateFrom !== lastFrom) return 1;

      return 0;

    });

  };

  if (nextHas) {

    return sortByPublishedFocus([nextPanel]);

  }

  if (currentHas) {

    return sortByPublishedFocus([currentPanel]);

  }

  return [nextPanel];

}



/** Call after admin publish/save so agent views drop stale session cache and refetch. */

export async function refreshScheduleQueriesAfterPublish(queryClient, { dateFrom, dateTo, records }) {

  clearCachedSchedule(dateFrom, dateTo);

  clearAllScheduleCaches();

  markLastPublishedScheduleWeek(dateFrom, dateTo);

  const inRange = filterRegistrationsForWeek(records, dateFrom, dateTo);

  queryClient.setQueryData(["shift-registrations", dateFrom, dateTo], inRange);

  await queryClient.invalidateQueries({ queryKey: ["shift-registrations"] });

}



export async function fetchWeekShiftRegistrations(weekDays) {

  const days = weekDays.map((d) => format(d, "yyyy-MM-dd"));

  const dateFrom = days[0];

  const dateTo = days[days.length - 1];

  const results = await Promise.all(

    days.map((d) => dataClient.entities.ShiftRegistration.filter({ date: d }))

  );

  return filterRegistrationsForWeek(results.flat(), dateFrom, dateTo);

}



export function formatScheduleLoadError(error) {

  const message = error?.message || String(error || "");

  if (message.includes("Supabase לא מוגדר") || message.includes("לא מוגדר חיבור נתונים")) {

    return "אין חיבור ל-Supabase. הגדר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ב-Vercel ופרוס מחדש.";

  }

  if (message.includes("relation") && message.includes("does not exist")) {

    return "טבלת shift_registrations חסרה ב-Supabase. הרץ את supabase/RUN_IN_SUPABASE.sql.";

  }

  if (message) return message;

  return "שגיאה בטעינת השיבוץ מהשרת.";

}


