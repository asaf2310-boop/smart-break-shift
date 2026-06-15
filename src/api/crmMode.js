import { demoModeEnabled } from "./demoMode";

/**
 * CRM — בדמו תמיד; בפרודקשן פעיל כברירת מחדל (נתונים ב-localStorage עד חיבור Supabase).
 * כיבוי מפורש: VITE_CRM_ENABLED=false
 */
export const crmEnabled =
  demoModeEnabled || import.meta.env.VITE_CRM_ENABLED !== "false";
