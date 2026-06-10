import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, ShieldCheck } from "lucide-react";
import AdminMetricsPanel from "@/components/admin/AdminMetricsPanel";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";

export default function AdminMetrics() {
  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <BackendConfigBanner />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <Link
          to="/admin"
          className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          ← דשבורד מנהל
        </Link>
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-1">
            <div
              className={hypHeaderIconClass(
                "bg-gradient-to-br from-violet-400 to-indigo-500 shadow-lg shadow-violet-500/30"
              )}
            >
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">מדדי נציגים</h1>
          </div>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            העלאת Excel ועדכון נתונים — מנהל בלבד
          </p>
        </div>
        <div className="w-24" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="m3-card p-4 sm:p-6"
      >
        <AdminMetricsPanel />
      </motion.div>
    </HypPageLayout>
  );
}
