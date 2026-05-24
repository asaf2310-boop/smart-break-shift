import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import KnowledgeChat from "@/components/knowledge/KnowledgeChat";
import { demoModeEnabled } from "@/api/demoClient";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function KnowledgePage() {
  const isAdmin = useIsAdmin();

  return (
    <div className="m3-page pt-app-nav" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-elevation-2">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="m3-headline-small text-xl font-semibold">שאל את הידע</h1>
              <p className="m3-label-medium">בסיס ידע · תשובות ממסמכי הארגון</p>
            </div>
          </div>
          <Link to="/" className="m3-btn-outlined text-xs py-2">
            <ArrowRight className="w-4 h-4" />
            ראשי
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="m3-card p-4 sm:p-6"
        >
          <KnowledgeChat />
        </motion.div>

        {demoModeEnabled && isAdmin && (
          <p className="m3-label-medium text-center mt-4">
            <Link to="/admin/knowledge" className="text-primary hover:underline">
              ניהול ידע (מנהל)
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
