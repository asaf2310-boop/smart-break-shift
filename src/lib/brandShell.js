import { demoModeEnabled } from "@/api/demoClient";

/** HYP blue visual shell on all routes — not tied to VITE_DEMO_MODE (data stays prod-gated). */
export const brandVisualEnabled = true;

/**
 * Document-level ambient: app-brand-background + app-hyp-demo when brand visuals are on.
 * Demo-only behavior (routes, seed data) remains behind demoModeEnabled elsewhere.
 */
export function applyBrandDocumentClasses() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("app-brand-background");
  if (brandVisualEnabled) {
    root.classList.add("app-hyp-demo");
  } else {
    root.classList.remove("app-hyp-demo");
  }
}

/** @deprecated use brandVisualEnabled — kept for imports that checked demo shell */
export const hypVisualShellEnabled = brandVisualEnabled;
