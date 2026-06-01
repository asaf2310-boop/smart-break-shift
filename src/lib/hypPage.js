import { demoModeEnabled } from "@/api/demoClient";
import { cn } from "@/lib/utils";

/** Ensures html ambient + HYP token overrides apply (main.jsx + App mount). */
export function applyHypDemoDocumentClasses() {
  if (!demoModeEnabled || typeof document === "undefined") return;
  document.documentElement.classList.add("app-brand-background", "app-hyp-demo");
}

/** Authenticated app shell — transparent on html.app-hyp-demo ambient */
export function hypDemoAppShellClass(className) {
  return cn(demoModeEnabled && "hyp-demo-app-shell min-h-screen font-heebo", className);
}

/** Root shell for breaks / shifts / admin scheduling pages */
export function schedulingPageRootClass(className) {
  return cn(
    demoModeEnabled
      ? "hyp-page hyp-scheduling-root min-h-screen font-heebo"
      : "min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50",
    className
  );
}

/** m3-page routes (CRM, knowledge, training, …) */
export function m3PageClass(className) {
  return cn(demoModeEnabled ? "hyp-page m3-page" : "m3-page", className);
}

export function hypIconTileClass(className) {
  return cn(demoModeEnabled ? "hyp-icon-tile" : "m3-icon-tile", className);
}

export function hypHeaderIconClass(className) {
  return cn(
    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
    demoModeEnabled ? "hyp-page-icon" : className
  );
}
