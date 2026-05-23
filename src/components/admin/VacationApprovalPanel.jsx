import React from "react";
import { dataClient } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Palmtree, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { WEEKDAY_LABELS } from "@/constants/scheduling";
import { getLiveQueryOptions } from "@/lib/liveQuery";

export default function VacationApprovalPanel({ weekDays }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo = format(weekDays[4], "yyyy-MM-dd");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vacation-requests-admin", dateFrom, dateTo],
    queryFn: async () => {
      const results = await Promise.all(
        weekDays.map((d) => dataClient.entities.VacationRequest.filter({ date: format(d, "yyyy-MM-dd") }))
      );
      return results.flat().filter((r) => r.status === "pending");
    },
    ...getLiveQueryOptions(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => dataClient.entities.VacationRequest.update(id, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-admin", dateFrom, dateTo] });
      queryClient.invalidateQueries({ queryKey: ["all-vac-view"] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests"] });
      toast({
        title: status === "approved" ? "✓ החופש אושר" : "הבקשה נדחתה",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 mb-4 text-center text-sm text-slate-400"
      >
        אין בקשות חופש ממתינות לשבוע זה
      </motion.div>
    );
  }

  const dayLabel = (dateStr) => {
    const idx = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === dateStr);
    const day = idx >= 0 ? WEEKDAY_LABELS[idx] : "";
    return `${day} ${format(new Date(dateStr + "T12:00:00"), "dd/MM")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden border border-orange-200 bg-white shadow-lg shadow-orange-100/50 mb-4"
    >
      <div className="px-6 py-4 bg-gradient-to-l from-orange-50 to-transparent border-b border-orange-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow">
          <Palmtree className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">אישור בקשות חופש</h2>
          <p className="text-xs text-slate-400">{requests.length} ממתינות</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-orange-100 bg-orange-50/40"
          >
            <div>
              <p className="font-bold text-slate-800">{req.agent_name}</p>
              <p className="text-sm text-slate-500">{dayLabel(req.date)}</p>
              {req.note && <p className="text-xs text-slate-400 mt-1">{req.note}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: req.id, status: "approved" })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                אישור
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: req.id, status: "rejected" })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                דחייה
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
