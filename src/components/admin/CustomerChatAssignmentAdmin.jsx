import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AGENT_ASSIGNMENT_MODES,
  getCustomerChatAssignmentConfig,
  resetCustomerChatAssignmentConfig,
  saveCustomerChatAssignmentConfig,
  subscribeCustomerChatAssignmentConfig,
} from "@/lib/customerChatAssignmentConfig";

export default function CustomerChatAssignmentAdmin() {
  const [mode, setMode] = useState(() => getCustomerChatAssignmentConfig().mode);
  const [saved, setSaved] = useState(false);

  const syncFromStore = useCallback(() => {
    setMode(getCustomerChatAssignmentConfig().mode);
  }, []);

  useEffect(() => subscribeCustomerChatAssignmentConfig(syncFromStore), [syncFromStore]);

  const handleSave = () => {
    saveCustomerChatAssignmentConfig({ mode });
    setMode(getCustomerChatAssignmentConfig().mode);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (!window.confirm("לאפס את הגדרות ההקצאה לברירת המחדל?")) return;
    resetCustomerChatAssignmentConfig();
    setMode(getCustomerChatAssignmentConfig().mode);
    setSaved(false);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-6" dir="rtl">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shrink-0">
          <UserCheck className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-lg font-extrabold text-slate-800">הקצאת שיחות לנציגים</h2>
          <p className="text-sm text-slate-500 mt-1">
            בחרו כיצד שיחות נכנסות מגיעות לנציגים לאחר סיום שלב הבוט. ההגדרה נשמרת בדפדפן (דמו).
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">מצב הקצאה</h3>
          <p className="text-xs text-slate-500 mt-0.5">חל על תור המתנה של צ'אט לקוחות</p>
        </div>

        <RadioGroup value={mode} onValueChange={setMode} className="space-y-3">
          {Object.values(AGENT_ASSIGNMENT_MODES).map((option) => (
            <div
              key={option.key}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                mode === option.key
                  ? "border-sky-300 bg-sky-50/80 ring-1 ring-sky-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <RadioGroupItem value={option.key} id={`assignment-${option.key}`} className="mt-0.5" />
              <Label htmlFor={`assignment-${option.key}`} className="flex-1 cursor-pointer space-y-1">
                <span className="text-sm font-semibold text-slate-800 block">{option.label}</span>
                <span className="text-xs text-slate-500 block leading-relaxed">{option.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <Button type="button" onClick={handleSave}>
          שמור הגדרות
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} className="gap-1">
          <RotateCcw className="w-4 h-4" />
          איפוס לברירת מחדל
        </Button>
        {saved && <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>}
      </div>
    </div>
  );
}
