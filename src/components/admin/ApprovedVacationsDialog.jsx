import React, { useMemo, useState } from "react";
import { dataClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Palmtree, CheckCircle2 } from "lucide-react";
import { parseDateStrLocal } from "@/constants/scheduling";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import {
  groupVacationRequests,
  formatVacationDateRange,
} from "@/lib/vacationRequestGrouping";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const APPROVED_QUERY_KEY = ["vacation-requests-admin", "all-approved"];

function formatDisplayDate(dateStr) {
  return format(parseDateStrLocal(dateStr), "dd/MM");
}

function formatSubmittedAt(isoStr) {
  if (!isoStr) return null;
  return format(new Date(isoStr), "dd/MM/yyyy");
}

export default function ApprovedVacationsDialog() {
  const [open, setOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: APPROVED_QUERY_KEY,
    queryFn: () => dataClient.entities.VacationRequest.filter({ status: "approved" }),
    enabled: open,
    ...getLiveQueryOptions(),
  });

  const groupedRequests = useMemo(() => {
    const groups = groupVacationRequests(requests);
    return [...groups].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [requests]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-sm font-semibold bg-white border border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 transition-all shadow-sm"
        >
          <Palmtree className="w-4 h-4" />
          חופשות מאושרות
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            חופשות מאושרות
          </DialogTitle>
          <DialogDescription>
            כל החופשות שאושרו — ללא הגבלת שבוע
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : groupedRequests.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">אין חופשות מאושרות</p>
          ) : (
            <div className="space-y-3">
              {groupedRequests.map((group) => {
                const rangeLabel = formatVacationDateRange(
                  group.startDate,
                  group.endDate,
                  formatDisplayDate
                );
                const firstRequest = requests.find((r) => r.id === group.ids[0]);
                const submittedAt = formatSubmittedAt(firstRequest?.created_at);
                const groupKey = `${group.agentName}-${group.startDate}-${group.endDate}-${group.note}`;

                return (
                  <div
                    key={groupKey}
                    className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40"
                  >
                    <p className="font-bold text-slate-800">{group.agentName}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{rangeLabel}</p>
                    {group.note?.trim() && (
                      <p className="text-xs text-slate-500 mt-1.5 bg-white/60 rounded-lg px-2 py-1 leading-snug">
                        {group.note}
                      </p>
                    )}
                    {submittedAt && (
                      <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                        הוגש ב-{submittedAt}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && groupedRequests.length > 0 && (
          <p className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
            {groupedRequests.length} חופשות מאושרות
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
