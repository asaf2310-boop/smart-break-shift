/** Admin routes from App.jsx — keep in sync when adding /admin/* pages. */
export const ADMIN_DEV_ROUTES = [
  { path: "/admin", label: "דשבורד מנהל" },
  { path: "/admin/knowledge", label: "ניהול ידע" },
  { path: "/admin/shifts", label: "משמרות (מנהל)" },
  { path: "/admin/users", label: "נציגים" },
];

export function isAdminDevLinksVisible() {
  return import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";
}

export function buildAdminDevUrl(origin, path) {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${path}`;
}
