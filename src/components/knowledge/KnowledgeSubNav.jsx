import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WEALTHY_GUIDE_BASE } from "@/lib/wealthyGuideConfig";

/** תת-ניווט למדריך תשלומים בלבד (שאל את הידע הוסר) */
export default function KnowledgeSubNav() {
  const { pathname } = useLocation();
  const active =
    pathname === WEALTHY_GUIDE_BASE || pathname.startsWith(`${WEALTHY_GUIDE_BASE}/`);

  return (
    <nav
      className="flex rounded-xl border border-outline/20 bg-surface-container-low p-1 gap-1 mb-6 min-w-0"
      dir="rtl"
      aria-label="מדריך תשלומים"
    >
      <Link
        to={WEALTHY_GUIDE_BASE}
        className={cn(
          "flex-1 min-w-0 text-center rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors leading-snug",
          active
            ? "bg-surface text-primary shadow-sm"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface/60",
        )}
      >
        מדריך תשלומים
      </Link>
    </nav>
  );
}
