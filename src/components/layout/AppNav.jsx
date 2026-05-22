import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarClock, CalendarDays, Home, ShieldCheck } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** גובה שורת הניווט התחתונה — משמש גם ל-FloatingChatWidget */
export const APP_NAV_HEIGHT = "var(--app-nav-height)";

export default function AppNav() {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const isBreaks = location.pathname === "/breaks";
  const isShifts = location.pathname === "/shifts";

  const tabClass = (active) =>
    `flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
        : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-slate-50 via-indigo-50/95 to-transparent pointer-events-none"
      dir="rtl"
      aria-label="ניווט ראשי"
    >
      <div className="pointer-events-auto w-full max-w-5xl overflow-x-auto pb-1">
        <div className="mx-auto flex w-max min-w-full sm:min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1 justify-center">
          <Link to="/" className={tabClass(location.pathname === "/")}>
            <Home className="w-4 h-4" />
            ראשי
          </Link>
          <Link to="/breaks" className={tabClass(isBreaks)}>
            <CalendarClock className="w-4 h-4" />
            הפסקות
          </Link>
          <Link to="/shifts" className={tabClass(isShifts)}>
            <CalendarDays className="w-4 h-4" />
            משמרות
          </Link>
          {isAdmin && (
            <>
              <Link to="/admin" className={tabClass(location.pathname === "/admin")}>
                <ShieldCheck className="w-4 h-4" />
                מנהל
              </Link>
              <Link to="/admin/shifts" className={tabClass(location.pathname === "/admin/shifts")}>
                <ShieldCheck className="w-4 h-4" />
                משמרות מנהל
              </Link>
              <Link to="/admin/users" className={tabClass(location.pathname === "/admin/users")}>
                <ShieldCheck className="w-4 h-4" />
                נציגים
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
