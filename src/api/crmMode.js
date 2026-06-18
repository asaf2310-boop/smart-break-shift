import { demoModeEnabled } from "./demoMode";

/**
 * CRM — בדמו: localStorage; בפרודקשן: Supabase כש-isCrmCloudEnabled() (ראו crmCloudMode.js).
 * כיבוי מפורש: VITE_CRM_ENABLED=false
 */
export const crmEnabled =
  demoModeEnabled || import.meta.env.VITE_CRM_ENABLED !== "false";
