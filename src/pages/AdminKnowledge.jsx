import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookMarked } from "lucide-react";
import KnowledgeAdmin from "@/components/knowledge/KnowledgeAdmin";

export default function AdminKnowledge() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-indigo-50/50" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-elevation-2">
              <BookMarked className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">ניהול ידע</h1>
              <p className="text-sm text-slate-500">
                העלאה ועריכת מסמכים (txt, md, PDF, Word docx) לבסיס הידע של הנציגים
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <ArrowRight className="w-4 h-4" />
              חזרה
            </Link>
            <Link to="/knowledge" className="text-xs text-primary hover:underline">
              תצוגת נציג
            </Link>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <KnowledgeAdmin />
        </motion.div>
      </div>
    </div>
  );
}
