import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, CalendarClock, CalendarDays, Contact, LogOut, Monitor } from "lucide-react";
import BrandEntryBlock from "@/components/brand/BrandEntryBlock";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import { demoModeEnabled } from "@/api/demoClient";
import { isAdminPinConfigured } from "@/hooks/useIsAdmin";
import { connectAgentAsAvailable } from "@/lib/agentChatPresence";
import { useAgentSession } from "@/hooks/useAgentSession";
import { agentLogout } from "@/lib/agentAuth";

const productionCards = [
  {
    to: "/breaks",
    title: "הפסקות",
    desc: "הזמנת הפסקת 10 דקות וצהריים",
    icon: CalendarClock,
    iconBg: "bg-primary-container text-on-primary-container",
  },
  {
    to: "/shifts",
    title: "משמרות",
    desc: "אילוצים, חופש ושיבוץ שבועי",
    icon: CalendarDays,
    iconBg: "bg-surface-container-high text-primary",
  },
];

const demoOnlyCards = [
  {
    to: "/crm",
    title: "CRM",
    desc: "לקוחות ותיעוד שיחות",
    icon: Contact,
    iconBg: "bg-secondary text-secondary-foreground",
  },
  {
    to: "/remote-support",
    title: "השתלטות מרחוק",
    desc: "שלב א: צפייה בדפדפן · RustDesk · סשנים",
    icon: Monitor,
    iconBg: "bg-violet-100 text-violet-900",
  },
  {
    to: "/knowledge",
    title: "בסיס ידע",
    desc: "שאלות ותשובות ממסמכי הארגון",
    icon: BookOpen,
    iconBg: "bg-primary-container text-on-primary-container",
  },
];

const homeCards = demoModeEnabled
  ? [...productionCards, ...demoOnlyCards]
  : productionCards;

const showAdminDemoHint =
  (import.meta.env.DEV || demoModeEnabled) && isAdminPinConfigured();

export default function Home() {
  const { displayName, isLoggedIn, refresh } = useAgentSession();
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
    <div className="m3-page" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[420px] h-[420px] bg-primary-container/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 pt-14 sm:pt-16 pb-8 sm:pb-16">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          {demoModeEnabled && <BrandEntryBlock className="mx-auto mb-4" />}
          <p className="m3-label-medium">
            שלום <span className="text-primary font-semibold">{displayName}</span>
            {agentCount > 0 && <> · {agentCount} נציגים</>}
          </p>
          {demoModeEnabled && (
            <div className="m3-badge mt-3">סביבת דמו · נתונים פיקטיביים בלבד</div>
          )}
          {showAdminDemoHint && (
            <Link
              to="/admin"
              className="mt-2 inline-block text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              כניסת מנהל: /admin (PIN: {adminPin})
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 inline-flex items-center gap-2 m3-label-medium text-on-surface-variant hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            התנתקות
          </button>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 items-stretch">
          {homeCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="h-full"
              >
                <Link
                  to={card.to}
                  className="m3-card flex flex-col h-full min-h-44 p-5 sm:p-6 hover:scale-[1.01] transition-transform group"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shrink-0`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="m3-label-large text-base font-semibold mb-1">{card.title}</h2>
                  <p className="m3-label-medium flex-1">{card.desc}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
