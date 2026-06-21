import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, CalendarClock, CalendarDays, Contact, GraduationCap, Home, MessageCircle, Monitor, ShieldCheck, Star } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAgentModules } from "@/hooks/useAgentModules";
import { useCrmRole } from "@/hooks/useCrmRole";
import { customerChatEnabled, crmEnabled, demoModeEnabled, knowledgeEnabled } from "@/api/demoClient";
import { brandVisualEnabled } from "@/lib/brandShell";
import { getCachedBearerToken } from "@/lib/agentAuthClient";
import { prefetchReviewSmsConfig } from "@/lib/reviewSms";

/** גובה שורת הניווט העליונה — משמש גם ל-FloatingChatWidget */
export const APP_NAV_HEIGHT = "var(--app-nav-height)";

export default function AppNav() {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const { hasModule, isLoggedIn } = useAgentModules();
  const { hasCrmAccess } = useCrmRole();
  const showTab = (moduleId) => !isLoggedIn || hasModule(moduleId);
  const showCrmTab = crmEnabled && (!isLoggedIn || hasCrmAccess || showTab("crm"));
  const isBreaks = location.pathname === "/breaks";
  const isShifts = location.pathname === "/shifts";
  const isTraining = location.pathname === "/training";
  const isMetrics =
    location.pathname === "/metrics" || location.pathname.startsWith("/metrics/");
  const isCrm = location.pathname.startsWith("/crm");
  const isKnowledge = location.pathname.startsWith("/knowledge");
  const isRemoteSupport = location.pathname.startsWith("/remote-support");
  const isGoogleReview = location.pathname.startsWith("/review-sms");
  const isCustomerChat = location.pathname.startsWith("/customer-chat");

  const useBrandNav = brandVisualEnabled;

  const tabClass = (active) =>
    `inline-flex shrink-0 items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
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
        <div className="min-w-0 overflow-x-hidden pt-1">
        <div
          className={`${
            useBrandNav ? "hyp-nav-bar" : "m3-nav-bar"
          } flex flex-wrap w-full p-1.5 gap-0.5 sm:gap-1 justify-center`}
        >
          <Link to="/" className={tabClass(location.pathname === "/")}>
            <Home className="w-4 h-4" />
            ראשי
          </Link>
          {showTab("breaks") && (
            <Link to="/breaks" className={tabClass(isBreaks)}>
              <CalendarClock className="w-4 h-4" />
              הפסקות
            </Link>
          )}
          {showTab("shifts") && (
            <Link to="/shifts" className={tabClass(isShifts)}>
              <CalendarDays className="w-4 h-4" />
              משמרות
            </Link>
          )}
          {showTab("training") && (
            <Link to="/training" className={tabClass(isTraining)}>
              <GraduationCap className="w-4 h-4" />
              הדרכה
            </Link>
          )}
          {showTab("metrics") && (
            <Link to="/metrics" className={tabClass(isMetrics)}>
              <BarChart3 className="w-4 h-4" />
              מדדים
            </Link>
          )}
          {showTab("remote_support") && (
            <Link to="/remote-support" className={tabClass(isRemoteSupport)}>
              <Monitor className="w-4 h-4" />
              השתלטות מרחוק
            </Link>
          )}
          {showTab("google_review") && (
            <Link
              to="/review-sms"
              className={tabClass(isGoogleReview)}
              onMouseEnter={() => prefetchReviewSmsConfig({ accessToken: getCachedBearerToken() })}
              onFocus={() => prefetchReviewSmsConfig({ accessToken: getCachedBearerToken() })}
            >
              <Star className="w-4 h-4" />
              דירוג גוגל
            </Link>
          )}
          {customerChatEnabled && !demoModeEnabled && showTab("customer_chat") && (
            <Link to="/customer-chat" className={tabClass(isCustomerChat)}>
              <MessageCircle className="w-4 h-4" />
              צ&apos;אט לקוחות
            </Link>
          )}
          {knowledgeEnabled && !demoModeEnabled && showTab("knowledge") && (
            <Link to="/knowledge" className={tabClass(isKnowledge)}>
              <BookOpen className="w-4 h-4" />
              בסיס ידע
            </Link>
          )}
          {showCrmTab && !demoModeEnabled && (
            <Link to="/crm" className={tabClass(isCrm)}>
              <Contact className="w-4 h-4" />
              CRM
            </Link>
          )}
          {demoModeEnabled && (
            <>
              {showCrmTab && (
                <Link to="/crm" className={tabClass(isCrm)}>
                  <Contact className="w-4 h-4" />
                  CRM
                </Link>
              )}
              {showTab("knowledge") && (
                <Link to="/knowledge" className={tabClass(isKnowledge)}>
                  <BookOpen className="w-4 h-4" />
                  בסיס ידע
                </Link>
              )}
              {showTab("customer_chat") && (
                <Link to="/customer-chat" className={tabClass(isCustomerChat)}>
                  <MessageCircle className="w-4 h-4" />
                  צ&apos;אט
                </Link>
              )}
            </>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={tabClass(
                location.pathname === "/admin" || location.pathname.startsWith("/admin/")
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              מנהל
            </Link>
          )}
        </div>
        </div>
      </div>
    </nav>
  );
}
