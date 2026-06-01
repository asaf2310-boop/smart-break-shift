import { demoModeEnabled } from "@/api/demoClient";
import { applyBrandDocumentClasses, brandVisualEnabled } from "@/lib/brandShell";
import { cn } from "@/lib/utils";

/** Ensures html ambient + HYP shell (main.jsx + App mount). */
export function applyHypDemoDocumentClasses() {
  applyBrandDocumentClasses();
}

/** Authenticated app shell — transparent on html.app-hyp-demo ambient */
export function hypDemoAppShellClass(className) {
  return cn(brandVisualEnabled && "hyp-demo-app-shell min-h-screen font-heebo", className);
}

/** Root shell for breaks / shifts / admin scheduling pages */
export function schedulingPageRootClass(className) {
  return cn(
    brandVisualEnabled
      ? "hyp-page hyp-scheduling-root min-h-screen font-heebo"
      : "min-h-screen m3-page pt-app-nav font-heebo",
    className
  );
}

/** m3-page routes (CRM, knowledge, training, …) */
export function m3PageClass(className) {
  return cn(brandVisualEnabled ? "hyp-page m3-page" : "m3-page", className);
}

export function hypIconTileClass(className) {
  return cn(brandVisualEnabled ? "hyp-icon-tile" : "m3-icon-tile", className);
}

export function hypHeaderIconClass(className) {
  return cn(
    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
    brandVisualEnabled ? "hyp-page-icon" : "m3-icon-tile",
    className
  );
}

/** Page header icon — HYP tile when brand shell is on. */
export function brandHeaderIconClass(className) {
  return hypHeaderIconClass(className);
}

/** @deprecated prefer brandVisualEnabled */
export const usesHypPageChrome = brandVisualEnabled;
