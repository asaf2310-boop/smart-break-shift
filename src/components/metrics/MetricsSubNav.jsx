import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/metrics", label: "טבלת מדדים" },
  { to: "/metrics/ranking", label: "ציון משוקלל" },
];

export default function MetricsSubNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 gap-1"
      dir="rtl"
      aria-label="תת-ניווט מדדים"
    >
      {TABS.map((tab) => {
        const active =
          tab.to === "/metrics"
            ? pathname === "/metrics"
            : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex-1 text-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-violet-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
