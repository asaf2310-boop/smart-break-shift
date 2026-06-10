<<<<<<< HEAD
const APP_TITLE = "מערכת ניהול מוקד";

const APP_DESCRIPTION =
  "מערכת לניהול הפסקות, אילוצי משמרות ושיבוץ שבועי במוקד.";

/** Build-time override via VITE_APP_TITLE; otherwise production default. */
export function getAppTitle() {
  const override = String(import.meta.env.VITE_APP_TITLE ?? "").trim();
  if (override) return override;
  return APP_TITLE;
}

function getAppDescription() {
  return APP_DESCRIPTION;
}

function setMetaContent(selector, content) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

/** Sync document title and social meta tags with demo/live mode. */
export function applyAppTitle() {
  const title = getAppTitle();
  const description = getAppDescription();

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}
=======
import { demoModeEnabled } from "@/api/demoClient";

const DEMO_TITLE = "מערכת ניהול מוקד · דמו";
const LIVE_TITLE = "מערכת ניהול מוקד";

const DEMO_DESCRIPTION =
  "מערכת דמו לניהול הפסקות, אילוצי משמרות ושיבוץ שבועי במוקד.";
const LIVE_DESCRIPTION =
  "מערכת לניהול הפסקות, אילוצי משמרות ושיבוץ שבועי במוקד.";

/** Build-time override via VITE_APP_TITLE; otherwise demo vs live default. */
export function getAppTitle() {
  const override = String(import.meta.env.VITE_APP_TITLE ?? "").trim();
  if (override) return override;
  return demoModeEnabled ? DEMO_TITLE : LIVE_TITLE;
}

function getAppDescription() {
  return demoModeEnabled ? DEMO_DESCRIPTION : LIVE_DESCRIPTION;
}

function setMetaContent(selector, content) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", content);
}

/** Sync document title and social meta tags with demo/live mode. */
export function applyAppTitle() {
  const title = getAppTitle();
  const description = getAppDescription();

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}
>>>>>>> 842dd9e (Initial commit)
