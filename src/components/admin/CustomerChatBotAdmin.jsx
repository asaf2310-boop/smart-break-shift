import React, { useCallback, useEffect, useState } from "react";
import { Bot, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOT_MESSAGE_PHASES,
  getCustomerChatBotConfig,
  resetCustomerChatBotConfig,
  saveCustomerChatBotConfig,
  subscribeCustomerChatBotConfig,
} from "@/lib/customerChatBotConfig";

function PhaseEditor({ phaseKey, label, description, messages, onChange }) {
  const addMessage = () => {
    onChange(phaseKey, [...messages, ""]);
  };

  const updateMessage = (index, value) => {
    const next = [...messages];
    next[index] = value;
    onChange(phaseKey, next);
  };

  const removeMessage = (index) => {
    onChange(
      phaseKey,
      messages.filter((_, i) => i !== index)
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{label}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 italic">אין הודעות בשלב זה</p>
        )}
        {messages.map((body, index) => (
          <div key={`${phaseKey}-${index}`} className="flex gap-2 items-start">
            <Input
              value={body}
              onChange={(e) => updateMessage(index, e.target.value)}
              placeholder="טקסט ההודעה"
              className="flex-1 text-right"
              dir="rtl"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-slate-400 hover:text-red-600"
              onClick={() => removeMessage(index)}
              aria-label="מחק הודעה"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addMessage} className="gap-1">
        <Plus className="w-4 h-4" />
        הוסף הודעה
      </Button>
    </section>
  );
}

export default function CustomerChatBotAdmin() {
  const [draft, setDraft] = useState(() => getCustomerChatBotConfig());
  const [saved, setSaved] = useState(false);

  const syncFromStore = useCallback(() => {
    setDraft(getCustomerChatBotConfig());
  }, []);

  useEffect(() => subscribeCustomerChatBotConfig(syncFromStore), [syncFromStore]);

  const handlePhaseChange = (phaseKey, messages) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [phaseKey]: messages,
    }));
  };

  const handleSave = () => {
    const cleaned = {
      sessionStart: draft.sessionStart.map((s) => s.trim()).filter(Boolean),
      beforeAgent: draft.beforeAgent.map((s) => s.trim()).filter(Boolean),
      afterBeforeAgent: draft.afterBeforeAgent.map((s) => s.trim()).filter(Boolean),
    };
    saveCustomerChatBotConfig(cleaned);
    setDraft(getCustomerChatBotConfig());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (!window.confirm("לאפס את הודעות הבוט לברירת המחדל?")) return;
    resetCustomerChatBotConfig();
    setDraft(getCustomerChatBotConfig());
    setSaved(false);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-6" dir="rtl">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-lg font-extrabold text-slate-800">הודעות בוט — צ'אט לקוחות</h2>
          <p className="text-sm text-slate-500 mt-1">
            עריכת ההודעות האוטומטיות שנשלחות ללקוח לפני חיבור לנציג. השינויים נשמרים בדפדפן (דמו).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.values(BOT_MESSAGE_PHASES).map((phase) => (
          <PhaseEditor
            key={phase.key}
            phaseKey={phase.key}
            label={phase.label}
            description={phase.description}
            messages={draft[phase.key] || []}
            onChange={handlePhaseChange}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <Button type="button" onClick={handleSave}>
          שמור הודעות
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
