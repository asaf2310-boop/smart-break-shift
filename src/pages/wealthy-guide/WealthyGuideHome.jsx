import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Ban,
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  GraduationCap,
  Link2,
  Plug,
  Receipt,
  RefreshCw,
  Settings,
  Shield,
} from "lucide-react";
import { wealthyGuideFeatures, wealthyGuidePath } from "@/lib/wealthyGuideConfig";

const FEATURE_ICONS = {
  "חיוב ידני": CreditCard,
  "לינק לתשלום": Link2,
  "הוראת קבע": RefreshCw,
  "פירוט עסקאות": Receipt,
  "עסקה בטוחה 3DS": Shield,
  "תוסף וורדפרס": Plug,
  'שגיאות שב"א': Ban,
  "חשבוניות דיגיטליות": FileText,
  דוחות: BarChart3,
  הגדרות: Settings,
  "ניהול התראות": Bell,
};

export default function WealthyGuideHome() {
  return (
    <div className="pb-12">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <GraduationCap className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-3">מדריך תשלומים לנציג</h1>
        <p className="text-on-surface-variant text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          ברוכים הבאים למדריך ההדרכה של מערכת ניהול התשלומים. לחצו על כל פיצ׳ר כדי ללמוד כיצד להשתמש בו.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wealthyGuideFeatures.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.title] || CreditCard;
          const path = wealthyGuidePath(feature.slug);

          return (
            <motion.div
              key={feature.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              {feature.ready ? (
                <Link
                  to={path}
                  className="group relative block m3-card p-6 h-full transition-all duration-300 hover:shadow-elevation-2 hover:-translate-y-0.5 border border-outline/10 hover:border-primary/25"
                >
                  <div
                    className={`w-11 h-11 ${feature.color} rounded-xl flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-1">{feature.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{feature.description}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>לעמוד ההדרכה</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </div>
                </Link>
              ) : (
                <div className="relative m3-card p-6 h-full opacity-55 border border-outline/10">
                  <span className="absolute top-3 left-3 text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full font-medium">
                    בקרוב
                  </span>
                  <div
                    className={`w-11 h-11 ${feature.color} rounded-xl flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-1">{feature.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{feature.description}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
