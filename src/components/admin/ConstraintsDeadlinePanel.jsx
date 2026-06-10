import React, { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save, Unlock } from "lucide-react";
import { dataClient } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import {
  getConstraintsDeadline,
  getConstraintsSubmissionWeekStart,
  getEffectiveConstraintsDeadline,
  isConstraintsSubmissionClosed,
  CONSTRAINTS_SUBMISSION_OVERRIDE_MESSAGE,
  formatDateStr,
} from "@/constants/scheduling";

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function datetimeLocalToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function ConstraintsDeadlinePanel({ constraintsWeekStart }) {
  const weekStartStr = formatDateStr(constraintsWeekStart);
  const submissionWeekStart = getConstraintsSubmissionWeekStart(constraintsWeekStart);
  const defaultDeadline = getConstraintsDeadline(submissionWeekStart);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsList = [] } = useQuery({
    queryKey: ["constraints-week-settings", weekStartStr],
    queryFn: () =>
      dataClient.entities.ConstraintsWeekSettings.filter({ week_start: weekStartStr }),
    ...getLiveQueryOptions(),
  });

  const existing = settingsList[0] || null;
  const now = new Date();

  const [form, setForm] = useState({
    submission_override_open: false,
    deadline_extended_until: "",
  });

  useEffect(() => {
    if (existing) {
      setForm({
        submission_override_open: existing.submission_override_open ?? false,
        deadline_extended_until: isoToDatetimeLocal(existing.deadline_extended_until),
      });
    } else {
      setForm({
        submission_override_open: false,
        deadline_extended_until: "",
      });
    }
  }, [existing?.id, weekStartStr]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        submission_override_open: data.submission_override_open,
        deadline_extended_until: datetimeLocalToIso(data.deadline_extended_until),
      };
      if (existing) {
        return dataClient.entities.ConstraintsWeekSettings.update(existing.id, payload);
      }
      return dataClient.entities.ConstraintsWeekSettings.create({
        ...payload,
        week_start: weekStartStr,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["constraints-week-settings", weekStartStr] });
      toast({ title: "✓ הגדרות דד-ליין נשמרו" });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא הצלחנו לשמור את הגדרות הדד-ליין" });
    },
  });

  const toggleOverrideMutation = useMutation({
    mutationFn: async (nextOpen) => {
      const payload = {
        submission_override_open: nextOpen,
        deadline_extended_until: datetimeLocalToIso(form.deadline_extended_until),
      };
      if (existing) {
        return dataClient.entities.ConstraintsWeekSettings.update(existing.id, payload);
      }
      return dataClient.entities.ConstraintsWeekSettings.create({
        ...payload,
        week_start: weekStartStr,
      });
    },
    onSuccess: (_, nextOpen) => {
      setForm((f) => ({ ...f, submission_override_open: nextOpen }));
      queryClient.invalidateQueries({ queryKey: ["constraints-week-settings", weekStartStr] });
      toast({
        title: nextOpen ? "הגשה נפתחה" : "הגשה חזרה לדד-ליין הרגיל",
        description: nextOpen
          ? "נציגים יכולים לערוך אילוצים גם לאחר רביעי 16:00"
          : "חזרה לכלל הרגיל — סגירה ברביעי בשעה 16:00",
      });
    },
    onError: () => {
      toast({ title: "שגיאה", description: "לא הצלחנו לעדכן את מצב ההגשה" });
    },
  });

  const previewSettings = {
    submission_override_open: form.submission_override_open,
    deadline_extended_until: datetimeLocalToIso(form.deadline_extended_until),
  };
  const effectiveDeadline = getEffectiveConstraintsDeadline(submissionWeekStart, previewSettings);
  const closedNow = isConstraintsSubmissionClosed(submissionWeekStart, previewSettings, now);
  const pastDefaultDeadline = now > defaultDeadline;

  const suggestExtendedDefault = () => {
    const friday = addDays(submissionWeekStart, 5);
    friday.setHours(16, 0, 0, 0);
    setForm((f) => ({
      ...f,
      deadline_extended_until: format(friday, "yyyy-MM-dd'T'HH:mm"),
    }));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
          <CalendarClock className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">הארכת מועד הגשת אילוצים</h2>
          <p className="text-xs text-slate-400">
            שבוע יעד {weekStartStr} (טופס נציגים) · דד-ליין רגיל: {format(defaultDeadline, "dd/MM בשעה HH:mm")}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div
          className={`rounded-2xl border px-4 py-3 space-y-3 ${
            form.submission_override_open
              ? "border-emerald-200 bg-emerald-50/80"
              : closedNow && pastDefaultDeadline
                ? "border-amber-200 bg-amber-50/60"
                : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Unlock
                className={`w-4 h-4 flex-shrink-0 ${
                  form.submission_override_open ? "text-emerald-600" : "text-slate-400"
                }`}
              />
              <div>
                <span className="text-sm font-semibold text-slate-700 block">פתיחת הגשה ידנית</span>
                <span className="text-xs text-slate-500">
                  אפשר לנציגים לערוך אילוצים ללא הגבלת זמן (גם לאחר הדד-ליין)
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={toggleOverrideMutation.isPending}
              onClick={() => toggleOverrideMutation.mutate(!form.submission_override_open)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                form.submission_override_open ? "bg-emerald-500" : "bg-slate-200"
              } disabled:opacity-50`}
              aria-pressed={form.submission_override_open}
              aria-label="פתיחת הגשת אילוצים ידנית"
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                  form.submission_override_open ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {form.submission_override_open && (
            <p className="text-xs text-emerald-800 leading-relaxed">
              {CONSTRAINTS_SUBMISSION_OVERRIDE_MESSAGE}
            </p>
          )}
          {closedNow && pastDefaultDeadline && !form.submission_override_open && (
            <p className="text-xs text-amber-800">
              הדד-ליין הרגיל עבר — הפעלת מתג או בחירת מועד מורחב תאפשר הגשה לנציגים.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">מועד אחרון מורחב</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="datetime-local"
              value={form.deadline_extended_until}
              onChange={(e) =>
                setForm((f) => ({ ...f, deadline_extended_until: e.target.value }))
              }
              disabled={form.submission_override_open}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:opacity-50 disabled:bg-slate-50"
              dir="ltr"
            />
            <button
              type="button"
              disabled={form.submission_override_open}
              onClick={suggestExtendedDefault}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50/50 disabled:opacity-50"
            >
              הצע יום ו׳ 16:00
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {form.submission_override_open
              ? "במצב פתיחה ידנית — מועד מורחב אינו נדרש."
              : form.deadline_extended_until
                ? `מועד אפקטיבי: ${format(effectiveDeadline, "dd/MM/yyyy בשעה HH:mm")}`
                : "השאר ריק לשימוש בדד-ליין הרגיל בלבד (רביעי 16:00)."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold shadow hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          שמור הגדרות דד-ליין
        </button>
      </div>
    </div>
  );
}
