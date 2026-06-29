import React from "react";
import { Lightbulb } from "lucide-react";

export default function FieldCard({ field, index }) {
  return (
    <div className="group bg-surface rounded-xl border border-outline/15 hover:border-primary/30 hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5">
        <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-base font-bold text-on-surface">{field.name}</h3>
            {field.required ? (
              <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full">
                שדה חובה
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs font-medium rounded-full">
                אופציונלי
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">{field.description}</p>
          {field.tip && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">{field.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
