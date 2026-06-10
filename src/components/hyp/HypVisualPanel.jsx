import React from "react";
import { motion } from "framer-motion";

/** Decorative right/left panel — gradients only, no logo. */
export default function HypVisualPanel({ className = "" }) {
  return (
    <div
      className={`hyp-visual-panel relative flex min-h-[220px] lg:min-h-full flex-col items-center justify-center overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="hyp-visual-panel__gradient absolute inset-0" />
      <div className="hyp-visual-panel__orb hyp-visual-panel__orb--a" />
      <div className="hyp-visual-panel__orb hyp-visual-panel__orb--b" />
      <div className="hyp-visual-panel__orb hyp-visual-panel__orb--c" />

      <div className="hyp-visual-panel__layers absolute inset-0 pointer-events-none">
        <span className="hyp-visual-panel__layer hyp-visual-panel__layer--pay" />
        <span className="hyp-visual-panel__layer hyp-visual-panel__layer--invoice" />
        <span className="hyp-visual-panel__layer hyp-visual-panel__layer--match" />
      </div>

      <motion.div
        className="relative z-[2] flex flex-col items-center gap-4 px-8 py-12 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="hyp-visual-panel__tagline max-w-xs text-base font-semibold leading-relaxed text-white/95 font-heebo">
          מערכת מוקד
        </p>
        <p className="hyp-visual-panel__tagline max-w-xs text-sm font-medium leading-relaxed text-white/80 font-heebo">
          ניהול משמרות והפסקות
        </p>
      </motion.div>
    </div>
  );
}