import { format } from "date-fns";
import { dataClient } from "@/api/client";

export function getScheduleCacheKey(dateFrom, dateTo) {
  return `shift-schedule-cache:${dateFrom}:${dateTo}`;
}

export function readCachedSchedule(dateFrom, dateTo) {
  try {
    const raw = sessionStorage.getItem(getScheduleCacheKey(dateFrom, dateTo));
    const parsed = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedSchedule(dateFrom, dateTo, data) {
  if (!Array.isArray(data) || data.length === 0) return;
  try {
    sessionStorage.setItem(getScheduleCacheKey(dateFrom, dateTo), JSON.stringify(data));
  } catch {
    // Cache is only a speed boost; ignore browsers that block storage.
  }
}

export async function fetchWeekShiftRegistrations(weekDays) {
  const days = weekDays.map((d) => format(d, "yyyy-MM-dd"));
  const results = await Promise.all(
    days.map((d) => dataClient.entities.ShiftRegistration.filter({ date: d }))
  );
  return results.flat();
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
