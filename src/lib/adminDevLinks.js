import { demoModeEnabled } from "@/api/demoClient";

const ADMIN_DEV_ROUTES_CORE = [
  { path: "/admin", label: "דשבורד מנהל" },
  { path: "/admin/shifts", label: "משמרות (מנהל)" },
  { path: "/admin/users", label: "נציגים" },
  { path: "/admin/recordings", label: "הקלטות" },
];

const ADMIN_DEV_ROUTES_DEMO = [
  { path: "/admin/knowledge", label: "ניהול ידע" },
  { path: "/admin/customer-chat", label: "בוט צ'אט לקוחות" },
  { path: "/chat/guest", label: "צ'אט לקוח (אורח)" },
  { path: "/customer-chat", label: "צ'אט לקוחות (נציג)" },
];

/** Admin routes from App.jsx — keep in sync when adding /admin/* pages. */
export const ADMIN_DEV_ROUTES = [
  ...ADMIN_DEV_ROUTES_CORE,
  ...(demoModeEnabled ? ADMIN_DEV_ROUTES_DEMO : []),
];

export function isAdminDevLinksVisible() {
  return import.meta.env.DEV || demoModeEnabled;
}

export function buildAdminDevUrl(origin, path) {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${path}`;
}
