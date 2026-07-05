import React from "react";
import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookMarked } from "lucide-react";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import AdminSubNav from "@/components/admin/AdminSubNav";
import AdminKnowledgeNav from "@/components/admin/AdminKnowledgeNav";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import { ADMIN_KNOWLEDGE_LABEL } from "@/lib/adminKnowledgeRoutes";

export default function AdminKnowledge() {
  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-3xl px-4 py-8">
      <BackendConfigBanner />
      <AdminSubNav />
      <AdminKnowledgeNav />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-elevation-2",
            )}
          >
            <BookMarked className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">{ADMIN_KNOWLEDGE_LABEL}</h1>
            <p className="text-sm text-slate-500">מדריך תשלומים · סוכן AI</p>
          </div>
        </div>
        <Link
          to="/admin"
          className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Outlet />
      </motion.div>
    </HypPageLayout>
  );
}
