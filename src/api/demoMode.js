/** Build-time demo flag — no app imports (avoids client ↔ demoClient cycles). */
export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === "true";
