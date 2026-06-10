import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, CalendarClock, CalendarDays, Contact, Film, GraduationCap, Home, MessageCircle, Monitor, ShieldCheck } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { customerChatEnabled, demoModeEnabled } from "@/api/demoClient";
import { brandVisualEnabled } from "@/lib/brandShell";

/** גובה שורת הניווט העליונה — משמש גם ל-FloatingChatWidget */
export const APP_NAV_HEIGHT = "var(--app-nav-height)";

export default function AppNav() {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const isBreaks = location.pathname === "/breaks";
  const isShifts = location.pathname === "/shifts";
  const isTraining = location.pathname === "/training";
  const isMetrics =
    location.pathname === "/metrics" || location.pathname.startsWith("/metrics/");
  const isCrm = location.pathname.startsWith("/crm");
  const isKnowledge = location.pathname.startsWith("/knowledge");
  const isRemoteSupport = location.pathname.startsWith("/remote-support");
  const isCustomerChat = location.pathname.startsWith("/customer-chat");

  const useBrandNav = brandVisualEnabled;

  const tabClass = (active) =>
    `flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
      active
        ? useBrandNav
          ? "hyp-nav-tab-active"
          : "m3-nav-tab-active"
        : useBrandNav
          ? "hyp-nav-tab-inactive"
          : "m3-nav-tab-inactive"
    }`;

  return (
    <nav
      className={
        useBrandNav
          ? "hyp-nav-shell fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pointer-events-none"
          : "fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] bg-gradient-to-b from-[#f7f3fb]/90 via-[#f7f3fb]/60 to-transparent pointer-events-none"
      }
      dir="rtl"
      aria-label="ניווט ראשי"
    >
      <div className="pointer-events-auto w-full max-w-5xl mx-auto">
        <div className="min-w-0 overflow-x-auto pt-1">
        <div
          className={`${
            useBrandNav ? "hyp-nav-bar" : "m3-nav-bar"
          } flex w-max min-w-full sm:min-w-0 p-1.5 gap-1 justify-center`}
        >
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
          <Link to="/training" className={tabClass(isTraining)}>
            <GraduationCap className="w-4 h-4" />
            הדרכה
          </Link>
          <Link to="/metrics" className={tabClass(isMetrics)}>
            <BarChart3 className="w-4 h-4" />
            מדדים
          </Link>
          <Link to="/remote-support" className={tabClass(isRemoteSupport)}>
            <Monitor className="w-4 h-4" />
            השתלטות מרחוק
          </Link>
          {customerChatEnabled && !demoModeEnabled && (
            <Link to="/customer-chat" className={tabClass(isCustomerChat)}>
              <MessageCircle className="w-4 h-4" />
              צ&apos;אט לקוחות
            </Link>
          )}
          {demoModeEnabled && (
            <>
              <Link to="/crm" className={tabClass(isCrm)}>
                <Contact className="w-4 h-4" />
                CRM
              </Link>
              <Link to="/knowledge" className={tabClass(isKnowledge)}>
                <BookOpen className="w-4 h-4" />
                בסיס ידע
              </Link>
              <Link to="/customer-chat" className={tabClass(isCustomerChat)}>
                <MessageCircle className="w-4 h-4" />
                צ&apos;אט
              </Link>
            </>
          )}
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
              <Link
                to="/admin/recordings"
                className={tabClass(location.pathname.startsWith("/admin/recordings"))}
              >
                <Film className="w-4 h-4" />
                הקלטות
              </Link>
              <Link
                to="/admin/metrics"
                className={tabClass(location.pathname.startsWith("/admin/metrics"))}
              >
                <BarChart3 className="w-4 h-4" />
                מדדים
              </Link>
              {demoModeEnabled && (
                <Link to="/admin/knowledge" className={tabClass(location.pathname === "/admin/knowledge")}>
                  <BookOpen className="w-4 h-4" />
                  ניהול ידע
                </Link>
              )}
              {customerChatEnabled && (
                <Link to="/admin/customer-chat" className={tabClass(location.pathname === "/admin/customer-chat")}>
                  <MessageCircle className="w-4 h-4" />
                  בוט צ&apos;אט
                </Link>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </nav>
  );
}
