import React from "react";
import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { ADMIN_KNOWLEDGE_BASE, ADMIN_KNOWLEDGE_LABEL } from "@/lib/adminKnowledgeRoutes";

/** כרטיס מודול ניהול ידע בלוח המנהל */
export default function AdminKnowledgeModuleCard() {
  return (
    <Link
      to={ADMIN_KNOWLEDGE_BASE}
      dir="rtl"
      className="group flex items-start gap-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-indigo-50/60 p-5 shadow-sm hover:border-violet-300 hover:shadow-md transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform">
        <BookMarked className="w-6 h-6" aria-hidden />
      </div>
      <div className="min-w-0 text-right">
        <h2 className="text-base font-extrabold text-slate-800">{ADMIN_KNOWLEDGE_LABEL}</h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          מדריך תשלומים לנציגים · סוכן AI ונתונים עסקיים
        </p>
      </div>
    </Link>
  );
}
