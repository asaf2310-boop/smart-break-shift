import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ADMIN_KNOWLEDGE_AI_AGENT,
  ADMIN_KNOWLEDGE_LABEL,
  ADMIN_KNOWLEDGE_PAYMENT_GUIDE,
} from "@/lib/adminKnowledgeRoutes";

const LINKS = [
  { path: ADMIN_KNOWLEDGE_PAYMENT_GUIDE, label: "מדריך תשלומים", exact: false },
  { path: ADMIN_KNOWLEDGE_AI_AGENT, label: "סוכן AI", exact: false },
];

function isActive(pathname, link) {
  if (link.exact) return pathname === link.path;
  return pathname === link.path || pathname.startsWith(`${link.path}/`);
}

export default function AdminKnowledgeNav({ className = "" }) {
  const { pathname } = useLocation();

  return (
    <nav
      dir="rtl"
      aria-label={ADMIN_KNOWLEDGE_LABEL}
      className={`mb-6 ${className}`.trim()}
    >
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 shadow-sm p-2">
        <div className="flex flex-wrap items-stretch gap-1.5">
          {LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`inline-flex shrink-0 items-center justify-center rounded-xl px-3.5 py-2.5 min-h-[2.75rem] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25"
                    : "bg-white text-slate-600 border border-violet-100 hover:border-violet-200 hover:bg-violet-50/80 hover:text-slate-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
