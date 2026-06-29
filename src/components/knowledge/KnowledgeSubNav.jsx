import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WEALTHY_GUIDE_BASE } from "@/lib/wealthyGuideConfig";

const TABS = [
  { to: "/knowledge", label: "שאל את הידע", exact: true },
  { to: WEALTHY_GUIDE_BASE, label: "מדריך תשלומים", exact: false },
];

export default function KnowledgeSubNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="flex rounded-xl border border-outline/20 bg-surface-container-low p-1 gap-1 mb-6"
      dir="rtl"
      aria-label="תת-ניווט בסיס ידע"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.to
          : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex-1 text-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-surface text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface/60"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
