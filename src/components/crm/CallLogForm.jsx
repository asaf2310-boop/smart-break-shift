import React, { useState } from "react";
import { format } from "date-fns";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CALL_TYPES, REFERRAL_TOPICS } from "@/lib/crmStore";
import { cn } from "@/lib/utils";

function toLocalDatetimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReferralTopicCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between rounded-xl font-normal h-9"
        >
          {value || "בחר נושא (אופציונלי)"}
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl" align="start" dir="rtl">
        <Command dir="rtl">
          <CommandInput placeholder="חיפוש נושא..." className="text-right" />
          <CommandList>
            <CommandEmpty>לא נמצא נושא</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="ללא נושא"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("ml-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                ללא נושא
              </CommandItem>
              {REFERRAL_TOPICS.map((topic) => (
                <CommandItem
                  key={topic}
                  value={topic}
                  onSelect={() => {
                    onChange(topic);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("ml-2 h-4 w-4", value === topic ? "opacity-100" : "opacity-0")} />
                  {topic}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CallLogForm({ agentName, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    occurred_at: toLocalDatetimeValue(),
    call_type: "incoming",
    referral_topic: "",
    summary: "",
    duration_minutes: "",
  });
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.summary.trim()) {
      setError("סיכום השיחה הוא שדה חובה");
      return;
    }
    if (!agentName) {
      setError("יש להתחבר כנציג כדי לתעד שיחה");
      return;
    }
    const occurred = new Date(form.occurred_at);
    if (Number.isNaN(occurred.getTime())) {
      setError("תאריך ושעה לא תקינים");
      return;
    }
    onSubmit({
      occurred_at: occurred.toISOString(),
      call_type: form.call_type,
      summary: form.summary,
      agent_name: agentName,
      duration_minutes: form.duration_minutes,
      referral_topic: form.referral_topic || null,
    });
    setForm({
      occurred_at: toLocalDatetimeValue(),
      call_type: "incoming",
      referral_topic: "",
      summary: "",
      duration_minutes: "",
    });
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
      <h3 className="font-bold text-slate-800">תיעוד שיחה חדשה</h3>
      {!agentName && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          יש להתחבר כנציג כדי לשמור תיעוד
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="call-datetime">תאריך ושעה</Label>
          <Input
            id="call-datetime"
            type="datetime-local"
            value={form.occurred_at}
            onChange={handleChange("occurred_at")}
            className="rounded-xl"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="call-type">סוג</Label>
          <select
            id="call-type"
            value={form.call_type}
            onChange={handleChange("call_type")}
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {CALL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="referral-topic">נושא הפניה (אופציונלי)</Label>
        <ReferralTopicCombobox
          value={form.referral_topic}
          onChange={(referral_topic) => setForm((prev) => ({ ...prev, referral_topic }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="call-summary">סיכום *</Label>
        <Textarea
          id="call-summary"
          value={form.summary}
          onChange={handleChange("summary")}
          placeholder="מה עלה בשיחה..."
          className="rounded-xl min-h-[90px]"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>נציג</Label>
          <Input value={agentName || "—"} readOnly className="rounded-xl bg-slate-50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="call-duration">משך (דקות, אופציונלי)</Label>
          <Input
            id="call-duration"
            type="number"
            min="0"
            value={form.duration_minutes}
            onChange={handleChange("duration_minutes")}
            placeholder="למשל 10"
            className="rounded-xl"
            dir="ltr"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
            ביטול
          </Button>
        )}
        <Button
          type="submit"
          disabled={!agentName}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          שמירת תיעוד
        </Button>
      </div>
    </form>
  );
}

export function formatCallDatetime(iso) {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
}
