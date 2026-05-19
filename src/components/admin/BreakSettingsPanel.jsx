import React, { useState, useEffect } from "react";
import { dataClient } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Settings, Save, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_NOTICE_TEXT = "עקב מחסור בנציגים, היום לא תתאפשר יציאה בזוגות להפסקת צהריים.";

export default function BreakSettingsPanel({ selectedDate }) {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsList = [] } = useQuery({
    queryKey: ["break-settings", dateStr],
    queryFn: () => dataClient.entities.BreakSettings.filter({ date: dateStr }),
  });

  const existing = settingsList[0] || null;

  const [form, setForm] = useState({
    lunch_max_per_slot: 1,
    short_max_per_slot: 1,
    show_shortage_notice: false,
    shortage_notice_text: DEFAULT_NOTICE_TEXT,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        lunch_max_per_slot: existing.lunch_max_per_slot ?? 1,
        short_max_per_slot: existing.short_max_per_slot ?? 1,
        show_shortage_notice: existing.show_shortage_notice ?? false,
        shortage_notice_text: existing.shortage_notice_text || DEFAULT_NOTICE_TEXT,
      });
    } else {
      setForm({
        lunch_max_per_slot: 1,
        short_max_per_slot: 1,
        show_shortage_notice: false,
        shortage_notice_text: DEFAULT_NOTICE_TEXT,
      });
    }
  }, [existing?.id, dateStr]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existing) {
        return dataClient.entities.BreakSettings.update(existing.id, data);
      } else {
        return dataClient.entities.BreakSettings.create({ ...data, date: dateStr });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-settings", dateStr] });
      toast({ title: "✓ ההגדרות נשמרו" });
    },
  });

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const Counter = ({ field, label }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleChange(field, Math.max(1, form[field] - 1))}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-all"
        >−</button>
        <span className="w-8 text-center font-bold text-slate-800">{form[field]}</span>
        <button
          onClick={() => handleChange(field, form[field] + 1)}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition-all"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-bold text-slate-800">הגדרות הפסקות ליום זה</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Capacity controls */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">מכסת נציגים למשבצת</p>
          <Counter field="lunch_max_per_slot" label="הפסקת צהריים" />
          <Counter field="short_max_per_slot" label='הפסקת 10 דקות' />
        </div>

        <div className="border-t border-slate-100" />

        {/* Shortage notice toggle */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">פופאפ מחסור בנציגים</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${form.show_shortage_notice ? "text-amber-500" : "text-slate-300"}`} />
              <span className="text-sm text-slate-600">הצג פופאפ בכניסה</span>
            </div>
            <button
              onClick={() => handleChange("show_shortage_notice", !form.show_shortage_notice)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                form.show_shortage_notice ? "bg-amber-400" : "bg-slate-200"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                form.show_shortage_notice ? "left-5" : "left-0.5"
              }`} />
            </button>
          </div>

          {form.show_shortage_notice && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">טקסט הפופאפ:</p>
              <textarea
                value={form.shortage_notice_text}
                onChange={e => handleChange("shortage_notice_text", e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none text-right"
              />
            </div>
          )}
        </div>

        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          שמור הגדרות
        </button>
      </div>
    </div>
  );
}