import { demoModeEnabled } from "@/api/demoClient";

/** Purple AllInCenter shell (login hero, ambient, home) — always on; not tied to VITE_DEMO_MODE. */
export const brandVisualEnabled = true;

/**
 * AllInCenter purple ambient + login/home branding.
 * Enabled for production and demo; HYP blue shell is demo-only (.app-hyp-demo).
 */
export function applyBrandDocumentClasses() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("app-brand-background");
  if (demoModeEnabled) {
    root.classList.add("app-hyp-demo");
  } else {
    root.classList.remove("app-hyp-demo");
  }
}
