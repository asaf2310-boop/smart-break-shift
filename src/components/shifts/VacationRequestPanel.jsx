import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, eachDayOfInterval } from "date-fns";
import { motion } from "framer-motion";
import { Palmtree, SendHorizonal, Check, X, Trash2, Plus } from "lucide-react";
import { dataClient } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  parseDateStrLocal,
  getVacationRequestDateBounds,
} from "@/constants/scheduling";

function formatDisplayDate(dateStr) {
  return format(parseDateStrLocal(dateStr), "dd/MM/yyyy");
}

function enumerateDateStrs(fromStr, toStr) {
  const start = parseDateStrLocal(fromStr);
  const end = parseDateStrLocal(toStr);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
}

export default function VacationRequestPanel({
  agentName,
  currentDateFrom,
  scheduleDateFrom,
  currentWeekPublished,
  nextWeekPublished,
  lastPublished,
  vacationRequests = [],
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { minDate, maxDate } = useMemo(
    () =>
      getVacationRequestDateBounds({
        currentDateFrom,
        scheduleDateFrom,
        currentWeekPublished,
        nextWeekPublished,
        lastPublished,
      }),
    [
      currentDateFrom,
      scheduleDateFrom,
      currentWeekPublished,
      nextWeekPublished,
      lastPublished,
    ]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(minDate);
  const [dateTo, setDateTo] = useState(minDate);
  const [note, setNote] = useState("");

  useEffect(() => {
    setDateFrom(minDate);
    setDateTo(minDate);
  }, [minDate]);

  const relevantRequests = useMemo(
    () =>
      vacationRequests
        .filter((r) => r.date >= minDate && r.date <= maxDate)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [vacationRequests, minDate, maxDate]
  );

  const invalidateVacationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
  };

  const createMutation = useMutation({
    mutationFn: async ({ dates, note: requestNote }) => {
      const results = await Promise.all(
        dates.map((date) =>
          dataClient.entities.VacationRequest.create({
            agent_name: agentName,
            date,
            note: requestNote,
            status: "pending",
          })
        )
      );
      return results;
    },
    onSuccess: (created) => {
      invalidateVacationQueries();
      setNote("");
      setDialogOpen(false);
      toast({
        title: "✓ בקשת החופש נשלחה",
        description:
          created.length === 1
            ? "יום אחד — ממתין לאישור מנהל"
            : `${created.length} ימים — ממתין לאישור מנהל`,
      });
    },
    onError: () => {
      toast({
        title: "שגיאה בשליחת בקשה",
        description: "לא הצלחנו לשמור — נסה שוב",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.VacationRequest.delete(id),
    onSuccess: () => {
      invalidateVacationQueries();
      toast({ title: "הבקשה בוטלה" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const from = dateFrom || minDate;
    const to = dateTo || from;

    if (from < minDate || to > maxDate) {
      toast({
        title: "תאריכים לא תקינים",
        description: `ניתן לבקש חופש בין ${formatDisplayDate(minDate)} ל-${formatDisplayDate(maxDate)}`,
        variant: "destructive",
      });
      return;
    }

    if (to < from) {
      toast({
        title: "טווח תאריכים לא תקין",
        description: "תאריך «עד» חייב להיות אחרי או שווה ל«מ»",
        variant: "destructive",
      });
      return;
    }

    const allDates = enumerateDateStrs(from, to);
    const existingDates = new Set(
      vacationRequests
        .filter((r) => r.status === "pending" || r.status === "approved")
        .map((r) => r.date)
    );
    const newDates = allDates.filter((d) => !existingDates.has(d));

    if (newDates.length === 0) {
      toast({
        title: "אין ימים חדשים לבקשה",
        description: "לכל הימים בטווח כבר קיימת בקשת חופש",
        variant: "destructive",
      });
      return;
    }

    const trimmedNote = note.trim();
    createMutation.mutate({ dates: newDates, note: trimmedNote });
  };

  const statusLabel = (status) => {
    if (status === "approved") return "אושר";
    if (status === "rejected") return "נדחה";
    return "ממתין";
  };

  const statusColor = (status) => {
    if (status === "approved") return "text-green-600 bg-green-50 border-green-200";
    if (status === "rejected") return "text-red-600 bg-red-50 border-red-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const groupedRequests = useMemo(() => {
    const groups = [];
    let current = null;

    for (const req of relevantRequests) {
      if (
        current &&
        current.status === req.status &&
        current.note === (req.note || "") &&
        enumerateDateStrs(current.endDate, req.date).length === 2
      ) {
        current.endDate = req.date;
        current.ids.push(req.id);
        continue;
      }
      current = {
        status: req.status,
        note: req.note || "",
        startDate: req.date,
        endDate: req.date,
        ids: [req.id],
      };
      groups.push(current);
    }
    return groups;
  }, [relevantRequests]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden border border-orange-200 bg-white shadow-lg shadow-orange-100/40"
      dir="rtl"
    >
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-l from-orange-50 to-transparent border-b border-orange-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow shadow-orange-500/30">
          <Palmtree className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">בקשה לחופש</h2>
          <p className="text-xs text-slate-500">
            החל מ-{formatDisplayDate(minDate)} · לאחר השיבוץ שכבר פורסם
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-500 text-white text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
        >
          <Plus className="w-4 h-4" />
          הגשת בקשה לחופש
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Palmtree className="w-5 h-5 text-orange-500" />
              הגשת בקשה לחופש
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              החל מ-{formatDisplayDate(minDate)} · לאחר השיבוץ שכבר פורסם
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">מ</span>
                <input
                  type="date"
                  value={dateFrom}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDateFrom(next);
                    if (dateTo < next) setDateTo(next);
                  }}
                  className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm outline-none focus:border-orange-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">עד</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || minDate}
                  max={maxDate}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm outline-none focus:border-orange-400"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600 mb-1.5 block">הערה (אופציונלי)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="סיבה לחופש..."
                rows={2}
                maxLength={280}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none text-right"
              />
            </label>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-500 text-white text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all disabled:opacity-50"
            >
              <SendHorizonal className="w-4 h-4" />
              {createMutation.isPending ? "שולח..." : "שלח בקשה"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {groupedRequests.length > 0 && (
        <div className="px-4 sm:px-6 pb-5 space-y-2 border-t border-orange-50 pt-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">הבקשות שלך</p>
          {groupedRequests.map((group) => {
            const rangeLabel =
              group.startDate === group.endDate
                ? formatDisplayDate(group.startDate)
                : `${formatDisplayDate(group.startDate)} – ${formatDisplayDate(group.endDate)}`;
            return (
              <div
                key={`${group.startDate}-${group.endDate}-${group.status}`}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${statusColor(group.status)}`}
              >
                <div className="flex items-start gap-2">
                  {group.status === "approved" ? (
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : group.status === "rejected" ? (
                    <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Palmtree className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{rangeLabel}</p>
                    <p className="text-xs opacity-80">{statusLabel(group.status)}</p>
                    {group.note && <p className="text-xs mt-0.5 opacity-70">{group.note}</p>}
                  </div>
                </div>
                {group.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => group.ids.forEach((id) => deleteMutation.mutate(id))}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors self-end sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ביטול
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
