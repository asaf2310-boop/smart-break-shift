import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarClock, CalendarDays, Home, ShieldCheck } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function AppNav() {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const isBreaks = location.pathname === "/breaks";
  const isShifts = location.pathname === "/shifts";

  const tabClass = (active) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
        : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="flex flex-col items-center gap-3 mb-6" dir="rtl">
      <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm p-1 gap-1 flex-wrap justify-center">
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
          </>
        )}
      </div>
    </div>
  );
}
