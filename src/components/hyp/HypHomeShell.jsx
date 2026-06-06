import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import HypVisualPanel from "@/components/hyp/HypVisualPanel";

/**
 * Demo home — split management + decorative visual (UI shell only).
 * Card `to` / icons / copy come from Home.jsx; no store or API changes.
 */
export default function HypHomeShell({
  displayName,
  agentCount,
  homeCards,
  showAdminDemoHint,
  adminPin,
  onLogout,
  showDemoBadge = false,
}) {
  return (
    <div className="hyp-home min-h-screen font-heebo" dir="rtl">
      <div className="hyp-home__layout lg:grid lg:grid-cols-2 lg:min-h-screen">
        <motion.section
          className="hyp-home__manage relative z-[1] flex flex-col px-4 sm:px-8 lg:px-10 pt-10 sm:pt-14 pb-10 lg:pb-14"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="mb-8 sm:mb-10">
            <p className="hyp-home__eyebrow mb-2">מרכז השליטה</p>
            <h1 className="hyp-home__title">שלום, {displayName}</h1>
            <p className="hyp-home__subtitle mt-2">
              {agentCount > 0 && (
                <>
                  <span>{agentCount} נציגים</span>
                  <span className="mx-2 opacity-40" aria-hidden>
                    ·
                  </span>
                </>
              )}
              בחרו מודול להמשך
            </p>
            {showDemoBadge && (
              <div className="hyp-home__badge mt-4">סביבת דמו · נתונים פיקטיביים בלבד</div>
            )}
            {showAdminDemoHint && (
              <Link to="/admin" className="hyp-home__admin-link mt-3 inline-block">
                כניסת מנהל: /admin (PIN: {adminPin})
              </Link>
            )}
            <button type="button" onClick={onLogout} className="hyp-home__logout mt-4">
              <LogOut className="w-3.5 h-3.5" aria-hidden />
              התנתקות
            </button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">
            {homeCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.to}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.07, duration: 0.4 }}
                  className="h-full"
                >
                  <Link to={card.to} className="hyp-home-card group flex h-full min-h-[9.5rem] flex-col p-5 sm:p-6">
                    <div className="hyp-home-card__icon mb-4 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="w-6 h-6" aria-hidden />
                    </div>
                    <h2 className="hyp-home-card__title">{card.title}</h2>
                    <p className="hyp-home-card__desc mt-1 flex-1">{card.desc}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <HypVisualPanel className="hidden lg:flex" />
      </div>

      <div className="lg:hidden border-t border-white/30">
        <HypVisualPanel className="min-h-[200px]" />
      </div>
    </div>
  );
}
