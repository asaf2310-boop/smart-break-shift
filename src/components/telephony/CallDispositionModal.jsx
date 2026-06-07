import React, { useEffect, useState } from "react";
import { PhoneOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ReferralTopicCombobox } from "@/components/crm/CallLogForm";

function formatCallBrief(call) {
  if (!call) return "";
  const dir = call.direction === "inbound" ? "נכנסת" : "יוצאת";
  const mins = Math.floor((call.duration_seconds || 0) / 60);
  const secs = (call.duration_seconds || 0) % 60;
  const dur = call.answered ? `${mins}:${String(secs).padStart(2, "0")}` : "—";
  return `${dir} · ${call.phone} · ${dur}`;
}

export default function CallDispositionModal({ open, call, onSubmit, onDismiss }) {
  const [summary, setSummary] = useState("");
  const [referralTopic, setReferralTopic] = useState("");

  useEffect(() => {
    if (!open) {
      setSummary("");
      setReferralTopic("");
    }
  }, [open, call?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ summary, referral_topic: referralTopic || null });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss?.()}>
      <DialogContent className="sm:max-w-md rounded-2xl shadow-elevation-3" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOff className="w-5 h-5 text-teal-700" />
            סיכום שיחה
          </DialogTitle>
        </DialogHeader>

        {call && (
          <div className="rounded-xl border border-outline/20 bg-surface-container-low px-3 py-2.5 text-sm space-y-1">
            {call.customer_name && (
              <p className="font-bold text-foreground">{call.customer_name}</p>
            )}
            {call.customer_company && (
              <p className="text-on-surface-variant">{call.customer_company}</p>
            )}
            <p className="font-mono text-xs text-on-surface-variant" dir="ltr">
              {formatCallBrief(call)}
            </p>
            {!call.customer_id && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1">
                לקוח לא מזוהה — התיעוד יישמר ביומן הטלפוניה בלבד
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disposition-summary">סיכום</Label>
            <Textarea
              id="disposition-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="מה עלה בשיחה?"
              className="rounded-xl min-h-[88px]"
            />
          </div>
          {call?.customer_id && (
            <div className="space-y-2">
              <Label>נושא הפניה (אופציונלי)</Label>
              <ReferralTopicCombobox value={referralTopic} onChange={setReferralTopic} />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onDismiss}>
              דילוג
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-gradient-to-l from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
            >
              שמירה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
