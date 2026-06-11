import React from "react";
import { BarChart3, BookOpen, CalendarClock, CalendarDays, Contact, GraduationCap, MessageCircle, Monitor } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import HypHomeShell from "@/components/hyp/HypHomeShell";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { customerChatEnabled, demoModeEnabled } from "@/api/demoClient";
import { isAdminPinConfigured } from "@/hooks/useIsAdmin";
import { connectAgentAsAvailable } from "@/lib/agentChatPresence";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useAgentModules } from "@/hooks/useAgentModules";
import { filterItemsByModules } from "@/constants/agentModules";
import { agentLogout } from "@/lib/agentAuth";

const productionCards = [
  {
    module: "breaks",
    to: "/breaks",
    title: "הפסקות",
    desc: "הזמנת הפסקת 10 דקות וצהריים להיום",
    icon: CalendarClock,
    iconTile: "m3-icon-tile",
  },
  {
    module: "shifts",
    to: "/shifts",
    title: "משמרות",
    desc: "אילוצים, חופש ושיבוץ שבועי",
    icon: CalendarDays,
    iconTile: "m3-icon-tile",
  },
  {
    module: "training",
    to: "/training",
    title: "הדרכה",
    desc: "לוח זמנים לקורס דיגיטל לנציגים חדשים",
    icon: GraduationCap,
    iconTile: "m3-icon-tile",
  },
  {
    module: "metrics",
    to: "/metrics",
    title: "מדדים",
    desc: "טבלת כל הנציגים וציון משוקלל",
    icon: BarChart3,
    iconTile: "m3-icon-tile",
  },
  {
    module: "remote_support",
    to: "/remote-support",
    title: "השתלטות מרחוק",
    desc: "צפייה בדפדפן · RustDesk · אישור ותיעוד",
    icon: Monitor,
    iconTile: "m3-icon-tile",
  },
];

const customerChatCard = {
  module: "customer_chat",
  to: "/customer-chat",
  title: "צ'אט לקוחות",
  desc: "תור המתנה, קבלת שיחות ומענה ללקוחות",
  icon: MessageCircle,
  iconTile: "m3-icon-tile",
};

const demoOnlyCards = [
  {
    module: "crm",
    to: "/crm",
    title: "CRM",
    desc: "לקוחות ותיעוד שיחות",
    icon: Contact,
    iconTile: "m3-icon-tile",
  },
  {
    module: "knowledge",
    to: "/knowledge",
    title: "בסיס ידע",
    desc: "שאלות ותשובות ממסמכי הארגון",
    icon: BookOpen,
    iconTile: "m3-icon-tile",
  },
  customerChatCard,
];

const liveCardsWithCustomerChat =
  customerChatEnabled && !demoModeEnabled
    ? [...productionCards, customerChatCard]
    : productionCards;

const homeCards = demoModeEnabled
  ? [...productionCards, ...demoOnlyCards]
  : liveCardsWithCustomerChat;

const showAdminDemoHint =
  (import.meta.env.DEV || demoModeEnabled) && isAdminPinConfigured();

function HomeContent() {
  const { displayName, isLoggedIn, refresh } = useAgentSession();
  const { modules } = useAgentModules();
  const visibleCards = filterItemsByModules(homeCards, modules);
  const agentCount = getAgentNamesList().length;
  const adminPin = String(import.meta.env.VITE_ADMIN_PIN ?? "").trim();

  const handleLoginSuccess = (session) => {
    connectAgentAsAvailable(session.displayName).catch(() => {});
    refresh();
  };

  const handleLogout = async () => {
    await agentLogout();
    refresh();
  };

  if (!isLoggedIn) {
    return <AgentLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <HypHomeShell
      displayName={displayName}
      agentCount={agentCount}
      homeCards={visibleCards}
      showAdminDemoHint={showAdminDemoHint}
      adminPin={adminPin}
      onLogout={handleLogout}
      showDemoBadge={demoModeEnabled}
    />
  );
}

export default function Home() {
  return (
    <RouteErrorBoundary>
      <HomeContent />
    </RouteErrorBoundary>
  );
}
