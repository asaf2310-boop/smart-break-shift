import React from "react";
import { BarChart3, BookOpen, CalendarClock, CalendarDays, Contact, GraduationCap, Loader2, MessageCircle, Monitor, Star } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import HypHomeShell from "@/components/hyp/HypHomeShell";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { customerChatEnabled, crmEnabled, demoModeEnabled, knowledgeEnabled } from "@/api/demoClient";
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

const knowledgeCard = {
  module: "knowledge",
  to: "/knowledge",
  title: "בסיס ידע",
  desc: "שאלות ותשובות ממסמכי הארגון (AI)",
  icon: BookOpen,
  iconTile: "m3-icon-tile",
};

const crmCard = {
  module: "crm",
  to: "/crm",
  title: "CRM",
  desc: "לקוחות ותיעוד שיחות",
  icon: Contact,
  iconTile: "m3-icon-tile",
};

const reviewSmsCard = {
  module: "google_review",
  to: "/review-sms",
  title: "דירוג גוגל",
  desc: "שליחת SMS ללקוח עם קישור לדירוג בגוגל",
  icon: Star,
  iconTile: "m3-icon-tile",
};

const demoOnlyCards = [
  crmCard,
  knowledgeCard,
  customerChatCard,
];

const liveCardsWithOptionalModules = [
  ...productionCards,
  reviewSmsCard,
  ...(customerChatEnabled && !demoModeEnabled ? [customerChatCard] : []),
  ...(knowledgeEnabled && !demoModeEnabled ? [knowledgeCard] : []),
  ...(crmEnabled && !demoModeEnabled ? [crmCard] : []),
];

const homeCards = demoModeEnabled
  ? [...productionCards, reviewSmsCard, ...demoOnlyCards]
  : liveCardsWithOptionalModules;

const showAdminDemoHint = import.meta.env.DEV || demoModeEnabled;

function HomeContent() {
  const { displayName, isLikelyLoggedIn, bootstrapped, refresh } = useAgentSession();
  const { rawModules } = useAgentModules();
  const visibleCards = filterItemsByModules(homeCards, rawModules);
  const agentCount = getAgentNamesList().length;

  const handleLoginSuccess = (session) => {
    connectAgentAsAvailable(session.displayName).catch(() => {});
    refresh();
  };

  const handleLogout = async () => {
    await agentLogout();
    refresh();
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="בודק התחברות" />
      </div>
    );
  }

  if (!isLikelyLoggedIn) {
    return <AgentLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <HypHomeShell
      displayName={displayName}
      agentCount={agentCount}
      homeCards={visibleCards}
      showAdminDemoHint={showAdminDemoHint}
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
