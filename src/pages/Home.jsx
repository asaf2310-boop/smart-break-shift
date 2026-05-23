import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, CalendarClock, CalendarDays, Contact, LogOut, Monitor, Users } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import { demoModeEnabled } from "@/api/demoClient";
import { isAdminPinConfigured } from "@/hooks/useIsAdmin";
import { connectAgentAsAvailable } from "@/lib/agentChatPresence";
import { useAgentSession } from "@/hooks/useAgentSession";
import { agentLogout } from "@/lib/agentAuth";

const cards = [
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

const showAdminDemoHint =
  (import.meta.env.DEV || demoModeEnabled) && isAdminPinConfigured();

export default function Home() {
  const { displayName, isLoggedIn, bootstrapped, refresh } = useAgentSession();
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

  if (!bootstrapped && !demoModeEnabled) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-outline-variant border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AgentLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="m3-page" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[420px] h-[420px] bg-primary-container/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-elevation-2">
            <Users className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
          </div>
          <h1 className="m3-headline-small font-medium mb-2">מערכת הפסקות ומשמרות</h1>
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={card.to}
                  className="m3-card block p-5 sm:p-6 hover:scale-[1.01] transition-transform group"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="m3-label-large text-base font-semibold mb-1">{card.title}</h2>
                  <p className="m3-label-medium">{card.desc}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
