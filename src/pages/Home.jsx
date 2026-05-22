import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarClock, CalendarDays, LogOut, ShieldCheck, Users } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getAgentNamesList } from "@/constants/scheduling";
import AgentLogin from "@/components/auth/AgentLogin";
import { demoModeEnabled } from "@/api/demoClient";
import { connectAgentAsAvailable } from "@/lib/agentChatPresence";
import { useAgentSession } from "@/hooks/useAgentSession";
import { agentLogout } from "@/lib/agentAuth";

const cards = [
  {
    to: "/breaks",
    title: "הפסקות",
    desc: "הזמנת הפסקת 10 דקות וצהריים",
    icon: CalendarClock,
    gradient: "from-indigo-500 to-purple-600",
  },
  {
    to: "/shifts",
    title: "משמרות",
    desc: "אילוצים, חופש ושיבוץ שבועי",
    icon: CalendarDays,
    gradient: "from-cyan-500 to-blue-600",
  },
];

export default function Home() {
  const isAdmin = useIsAdmin();
  const { displayName, isLoggedIn, bootstrapped, refresh } = useAgentSession();
  const agentCount = getAgentNamesList().length;

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
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AgentLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2">מערכת הפסקות ומשמרות</h1>
          <p className="text-slate-500 text-sm">
            שלום <span className="text-indigo-600 font-semibold">{displayName}</span>
            {agentCount > 0 && <> · {agentCount} נציגים</>}
          </p>
          {demoModeEnabled && (
            <div className="inline-flex mt-3 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
              סביבת דמו · נתונים פיקטיביים בלבד
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            התנתקות
          </button>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
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
                  className="block rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-md group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1">{card.title}</h2>
                  <p className="text-sm text-slate-500">{card.desc}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span className="font-bold text-slate-800 text-sm">אזור מנהל</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin"
                className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-slate-700 hover:border-amber-400 transition-colors"
              >
                ניהול הפסקות
              </Link>
              <Link
                to="/admin/shifts"
                className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-slate-700 hover:border-amber-400 transition-colors"
              >
                ניהול משמרות
              </Link>
              <Link
                to="/admin/users"
                className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-slate-700 hover:border-amber-400 transition-colors"
              >
                ניהול נציגים
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
