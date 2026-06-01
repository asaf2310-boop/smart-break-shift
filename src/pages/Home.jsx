import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, CalendarClock, CalendarDays, Contact, GraduationCap, LogOut, Monitor } from "lucide-react";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import BrandHomeHero from "@/components/brand/BrandHomeHero";
import HypHomeShell from "@/components/hyp/HypHomeShell";
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
    iconTile: "m3-icon-tile",
  },
  {
    to: "/shifts",
    title: "משמרות",
    desc: "אילוצים, חופש ושיבוץ שבועי",
    icon: CalendarDays,
    iconTile: "m3-icon-tile",
  },
  {
    to: "/training",
    title: "הדרכה",
    desc: "לוח זמנים לקורס דיגיטל לנציגים חדשים",
    icon: GraduationCap,
    iconTile: "m3-icon-tile",
  },
];

const demoOnlyCards = [
  {
    to: "/crm",
    title: "CRM",
    desc: "לקוחות ותיעוד שיחות",
    icon: Contact,
    iconTile: "m3-icon-tile",
  },
  {
    to: "/remote-support",
    title: "השתלטות מרחוק",
    desc: "שלב א: צפייה בדפדפן · RustDesk · סשנים",
    icon: Monitor,
    iconTile: "m3-icon-tile",
  },
  {
    to: "/knowledge",
    title: "בסיס ידע",
    desc: "שאלות ותשובות ממסמכי הארגון",
    icon: BookOpen,
    iconTile: "m3-icon-tile",
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

  if (demoModeEnabled) {
    return (
      <HypHomeShell
        displayName={displayName}
        agentCount={agentCount}
        homeCards={homeCards}
        showAdminDemoHint={showAdminDemoHint}
        adminPin={adminPin}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="m3-page font-heebo" dir="rtl">
      <motion.div className="relative z-10 max-w-3xl mx-auto px-4 pt-10 sm:pt-14 pb-8 sm:pb-16">
        <BrandHomeHero className="max-w-[min(340px,80vw)]" />
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-10"
        >
          <h1 className="m3-headline-small mb-2 text-brand-gradient">מרכז השליטה</h1>
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
                  className="m3-card flex flex-col h-full min-h-44 p-5 sm:p-6 group"
                >
                  <div
                    className={`w-12 h-12 mb-4 group-hover:scale-105 transition-transform ${card.iconTile}`}
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
      </motion.div>
    </div>
  );
}
