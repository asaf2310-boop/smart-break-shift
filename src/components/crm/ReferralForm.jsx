import React, { useEffect, useState } from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REFERRAL_STATUSES } from "@/lib/crmStore";
import { ReferralTopicCombobox } from "@/components/crm/CallLogForm";
import ReferralAssignmentFields from "@/components/crm/ReferralAssignmentFields";

const SAVE_OPTIONS = [
  { status: "open", label: REFERRAL_STATUSES.open.label },
  { status: "closed", label: REFERRAL_STATUSES.closed.label },
];

export default function ReferralForm({ agentName, onSubmit }) {
  const [form, setForm] = useState({
    referral_topic: "",
    description: "",
  });
  const [saveAs, setSaveAs] = useState("open");
  const [assignment, setAssignment] = useState({
    assigned_to_type: "agent",
    assigned_agent_name: agentName || "",
    assigned_department_id: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (agentName && assignment.assigned_to_type === "agent" && !assignment.assigned_agent_name) {
      setAssignment((prev) => ({ ...prev, assigned_agent_name: agentName }));
    }
  }, [agentName, assignment.assigned_to_type, assignment.assigned_agent_name]);

  const selectedLabel = SAVE_OPTIONS.find((o) => o.status === saveAs)?.label || SAVE_OPTIONS[0].label;

  const submitWithStatus = (status) => {
    if (!form.referral_topic.trim()) {
      setError("יש לבחור נושא הפניה (סליקה / חשבוניות)");
      return;
    }
    if (!form.description.trim()) {
      setError("תיאור הפניה הוא שדה חובה");
      return;
    }
    if (!agentName) {
      setError("יש להתחבר כנציג כדי לפתוח פניה");
      return;
    }
    onSubmit({
      referral_topic: form.referral_topic,
      description: form.description,
      agent_name: agentName,
      status,
      ...assignment,
    });
    setForm({ referral_topic: "", description: "" });
    setAssignment({
      assigned_to_type: "agent",
      assigned_agent_name: agentName || "",
      assigned_department_id: null,
    });
    setSaveAs("open");
    setError("");
  };

  const handlePrimarySave = (e) => {
    e.preventDefault();
    submitWithStatus(saveAs);
  };

  return (
    <form onSubmit={handlePrimarySave} className="space-y-4 rounded-2xl border border-teal-200 bg-white p-4 shadow-sm" dir="rtl">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-teal-600" />
        פניה / הפניה חדשה
      </h3>
      {!agentName && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          יש להתחבר כנציג כדי לשמור פניה
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="ref-topic">נושא הפניה *</Label>
        <ReferralTopicCombobox
          value={form.referral_topic}
          onChange={(referral_topic) => setForm((prev) => ({ ...prev, referral_topic }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ref-desc">תיאור הפניה *</Label>
        <Textarea
          id="ref-desc"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="פרטי הבקשה, מה נדרש מהלקוח..."
          className="rounded-xl min-h-[90px]"
        />
      </div>
      <div className="space-y-2">
        <Label>יוצר הפניה</Label>
        <Input value={agentName || "—"} readOnly className="rounded-xl bg-slate-50" />
      </div>
      <ReferralAssignmentFields
        value={assignment}
        onChange={setAssignment}
        defaultAgentName={agentName}
      />
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <div className="flex justify-end">
        <div className="inline-flex rounded-xl overflow-hidden shadow-sm border border-teal-300">
          <Button
            type="submit"
            disabled={!agentName}
            className="rounded-none rounded-r-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 px-5"
          >
            שמירה — {selectedLabel}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                disabled={!agentName}
                className="rounded-none rounded-l-xl border-r border-teal-400/50 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 px-2.5"
                aria-label="בחירת סטטוס שמירה"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl min-w-[10rem]" dir="rtl">
              {SAVE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.status}
                  onSelect={() => {
                    setSaveAs(opt.status);
                    submitWithStatus(opt.status);
                  }}
                  className="font-semibold cursor-pointer"
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        פתוח — הפניה נכנסת לתור הנציג או מחלקה שנבחרו. הסתיים טיפול — נסגרת; תגובת לקוח תוך 7 ימים תחזיר ליוצר המקורי.
      </p>
    </form>
  );
}
