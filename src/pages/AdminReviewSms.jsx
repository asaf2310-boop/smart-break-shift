import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import AdminSubNav from "@/components/admin/AdminSubNav";
import ReviewSmsSettingsPanel from "@/components/admin/ReviewSmsSettingsPanel";
import BackendConfigBanner from "@/components/BackendConfigBanner";

export default function AdminReviewSms() {
  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <BackendConfigBanner />
      <AdminSubNav />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center gap-1 mb-4">
          ← חזרה לניהול
        </Link>
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-1">
            <div
              className={hypHeaderIconClass(
                "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30"
              )}
            >
              <Star className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">דירוג גוגל</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">הגדרות קישור SMS לדירוג בגוגל</p>
        </div>
      </motion.div>

      <ReviewSmsSettingsPanel />
    </HypPageLayout>
  );
}
