import React from "react";
import { Link, useLocation } from "react-router-dom";
import { customerChatEnabled, crmEnabled, demoModeEnabled, knowledgeEnabled } from "@/api/demoClient";

function buildAdminNavLinks() {
  const links = [
    { path: "/admin", label: "דשבורד", match: "exact" },
    { path: "/admin/shifts", label: "משמרות" },
    { path: "/admin/users", label: "נציגים" },
    { path: "/admin/training", label: "הדרכה" },
    { path: "/admin/recordings", label: "הקלטות", matchPrefix: "/admin/recordings" },
    { path: "/admin/metrics", label: "מדדים", matchPrefix: "/admin/metrics" },
    { path: "/admin/security-audit", label: "יומן ביקורת" },
    { path: "/admin/sms-stats", label: "סטטיסטיקת SMS" },
    { path: "/review-sms", label: "דירוג גוגל" },
  ];

  if (demoModeEnabled || knowledgeEnabled) {
    links.push({ path: "/admin/knowledge", label: "ניהול ידע", matchPrefix: "/admin/knowledge" });
  }

  if (crmEnabled) {
    links.push(
      { path: "/admin/crm", label: "דשבורד CRM", matchPrefix: "/admin/crm" },
      { path: "/admin/crm/departments", label: "מחלקות CRM" },
      { path: "/admin/crm/routing", label: "ניתוב CRM" }
    );
  }

  if (customerChatEnabled) {
    links.push({ path: "/admin/customer-chat", label: "בוט צ'אט" });
  }

  return links;
}

function isLinkActive(pathname, link) {
  if (link.match === "exact") return pathname === link.path;
  if (link.path === "/admin/crm") return pathname === "/admin/crm";
  const prefix = link.matchPrefix || link.path;
  return pathname === link.path || pathname.startsWith(`${prefix}/`);
}

export default function AdminSubNav({ className = "" }) {
  const { pathname } = useLocation();
  const links = buildAdminNavLinks();

  return (
    <nav
      dir="rtl"
      aria-label="ניווט מנהל"
      className={`mb-6 ${className}`.trim()}
    >
      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-2 sm:p-2.5">
        <div className="overflow-x-auto overscroll-x-contain -mx-0.5 px-0.5 pb-0.5 sm:overflow-visible">
          <div className="flex flex-nowrap sm:flex-wrap items-stretch gap-1.5 sm:gap-2 min-w-0 sm:min-w-full w-max sm:w-auto max-w-none sm:max-w-full">
            {links.map((link) => {
              const active = isLinkActive(pathname, link);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`inline-flex shrink-0 items-center justify-center rounded-xl px-3 sm:px-3.5 py-2.5 min-h-[2.75rem] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25"
                      : "bg-slate-50 text-slate-600 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/60 hover:text-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
