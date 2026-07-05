import { customerChatEnabled, crmEnabled, demoModeEnabled } from "@/api/demoClient";

const ADMIN_DEV_ROUTES_CORE = [
  { path: "/admin", label: "דשבורד מנהל" },
  { path: "/admin/shifts", label: "משמרות (מנהל)" },
  { path: "/admin/users", label: "נציגים" },
  { path: "/admin/recordings", label: "הקלטות" },
  { path: "/admin/metrics", label: "מדדים" },
  { path: "/admin/security-audit", label: "יומן ביקורת אבטחה" },
  { path: "/admin/sms-stats", label: "סטטיסטיקת SMS לפי נציג" },
  { path: "/admin/review-sms", label: "דירוג גוגל (הגדרות)" },
  { path: "/admin/knowledge", label: "ניהול ידע" },
  { path: "/admin/knowledge/payment-guide", label: "מדריך תשלומים (אדמין)" },
  { path: "/admin/knowledge/ai-agent", label: "סוכן AI (אדמין)" },
  { path: "/ai-agent", label: "סוכן AI" },
];

const ADMIN_DEV_ROUTES_CRM = [{ path: "/crm", label: "CRM (נציגים)" }];

const ADMIN_DEV_ROUTES_CUSTOMER_CHAT = [
  { path: "/admin/customer-chat", label: "בוט צ'אט לקוחות" },
  { path: "/chat/guest", label: "צ'אט לקוח (אורח)" },
  { path: "/customer-chat", label: "צ'אט לקוחות (נציג)" },
];

/** Admin routes from App.jsx — keep in sync when adding /admin/* pages. */
export const ADMIN_DEV_ROUTES = [
  ...ADMIN_DEV_ROUTES_CORE,
  ...(crmEnabled ? ADMIN_DEV_ROUTES_CRM : []),
  ...(customerChatEnabled ? ADMIN_DEV_ROUTES_CUSTOMER_CHAT : []),
];

export function isAdminDevLinksVisible() {
  return import.meta.env.DEV || demoModeEnabled;
}

export function buildAdminDevUrl(origin, path) {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${path}`;
}
