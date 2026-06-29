import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WEALTHY_GUIDE_BASE } from "@/lib/wealthyGuideConfig";
import { useAgentModules } from "@/hooks/useAgentModules";

const ALL_TABS = [
  { to: "/knowledge", label: "שאל את הידע", exact: true, module: "knowledge_chat" },
  { to: WEALTHY_GUIDE_BASE, label: "מדריך תשלומים", exact: false, module: "knowledge_guide" },
];

export default function KnowledgeSubNav() {
  const { pathname } = useLocation();
  const { hasModule, isLoggedIn } = useAgentModules();

  const tabs = useMemo(
    () =>
      ALL_TABS.filter((tab) => !isLoggedIn || !tab.module || hasModule(tab.module)),
    [hasModule, isLoggedIn]
  );

  if (tabs.length <= 1) return null;

  return (
    <nav
      className="flex rounded-xl border border-outline/20 bg-surface-container-low p-1 gap-1 mb-6 min-w-0"
      dir="rtl"
      aria-label="תת-ניווט בסיס ידע"
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.to
          : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex-1 min-w-0 text-center rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors leading-snug",
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
