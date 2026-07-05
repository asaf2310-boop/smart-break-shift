import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import { wealthyGuidePath } from "@/lib/wealthyGuideConfig";

export default function WealthyGuideComingSoon() {
  const { pathname } = useLocation();
  const segment = pathname.split("/").pop() || "";

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center mb-5">
        <Construction className="w-7 h-7 text-on-surface-variant" />
      </div>
      <h1 className="text-xl font-bold text-on-surface mb-2">בקרוב</h1>
      <p className="text-sm text-on-surface-variant max-w-md leading-relaxed mb-6">
        עמוד ההדרכה עבור &quot;{decodeURIComponent(segment)}&quot; עדיין בפיתוח. כרגע זמינים מדריכי
        חיוב ידני, לינק לתשלום ופירוט עסקאות.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to={wealthyGuidePath("manual-charge")} className="m3-btn-filled text-sm py-2">
          מדריך חיוב ידני
        </Link>
        <Link to={wealthyGuidePath()} className="m3-btn-outlined text-sm py-2">
          חזרה לרשימה
        </Link>
      </div>
    </div>
  );
}
