import { demoModeEnabled } from "@/api/demoClient";
import { supabaseConfigured } from "@/api/supabase";
import { crmEnabled } from "@/api/crmMode";

/** CRM בענן — Supabase + RLS (לא בדמו). כיבוי: VITE_CRM_CLOUD=false */
export function isCrmCloudEnabled() {
  return (
    !demoModeEnabled &&
    supabaseConfigured &&
    crmEnabled &&
    import.meta.env.VITE_CRM_CLOUD !== "false"
  );
}
