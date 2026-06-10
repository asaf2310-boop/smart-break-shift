<<<<<<< HEAD
import { customerChatEnabled, demoModeEnabled } from "@/api/demoClient";
=======
import { demoModeEnabled } from "@/api/demoClient";
>>>>>>> 842dd9e (Initial commit)

const ADMIN_DEV_ROUTES_CORE = [
  { path: "/admin", label: "דשבורד מנהל" },
  { path: "/admin/shifts", label: "משמרות (מנהל)" },
  { path: "/admin/users", label: "נציגים" },
<<<<<<< HEAD
  { path: "/admin/recordings", label: "הקלטות" },
  { path: "/admin/metrics", label: "מדדים" },
];

const ADMIN_DEV_ROUTES_DEMO_ONLY = [{ path: "/admin/knowledge", label: "ניהול ידע" }];

const ADMIN_DEV_ROUTES_CUSTOMER_CHAT = [
  { path: "/admin/customer-chat", label: "בוט צ'אט לקוחות" },
  { path: "/chat/guest", label: "צ'אט לקוח (אורח)" },
  { path: "/customer-chat", label: "צ'אט לקוחות (נציג)" },
];
=======
];

const ADMIN_DEV_ROUTES_DEMO = [{ path: "/admin/knowledge", label: "ניהול ידע" }];
>>>>>>> 842dd9e (Initial commit)

/** Admin routes from App.jsx — keep in sync when adding /admin/* pages. */
export const ADMIN_DEV_ROUTES = [
  ...ADMIN_DEV_ROUTES_CORE,
<<<<<<< HEAD
  ...(demoModeEnabled ? ADMIN_DEV_ROUTES_DEMO_ONLY : []),
  ...(customerChatEnabled ? ADMIN_DEV_ROUTES_CUSTOMER_CHAT : []),
=======
  ...(demoModeEnabled ? ADMIN_DEV_ROUTES_DEMO : []),
>>>>>>> 842dd9e (Initial commit)
];

export function isAdminDevLinksVisible() {
  return import.meta.env.DEV || demoModeEnabled;
}

export function buildAdminDevUrl(origin, path) {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${path}`;
}
