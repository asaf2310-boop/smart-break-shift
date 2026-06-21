import React, { useEffect, useMemo, useState } from "react";
import { FolderOpen, Phone, UserCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCustomerByPhone, REFERRAL_PRIORITIES } from "@/lib/crmStore";
import { findRoutingRuleForTopic } from "@/lib/crmRoutingRules";
import { getDepartmentName } from "@/lib/crmDepartments";
import { ReferralTopicCombobox } from "@/components/crm/CallLogForm";
import ReferralAssignmentFields from "@/components/crm/ReferralAssignmentFields";
import { cn } from "@/lib/utils";

const emptyForm = {
  phone: "",
  name: "",
  referral_topic: "",
  description: "",
  priority: "normal",
};

export default function ManualReferralForm({ agentName, onSubmit, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [autoRoute, setAutoRoute] = useState(true);
  const [assignment, setAssignment] = useState({
    assigned_to_type: "agent",
    assigned_agent_name: agentName || "",
    assigned_department_id: null,
  });
  const [error, setError] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");

  const matchedCustomer = useMemo(() => {
    const phone = lookupPhone.trim();
    if (phone.length < 7) return null;
    return getCustomerByPhone(phone);
  }, [lookupPhone]);

  useEffect(() => {
    if (agentName && assignment.assigned_to_type === "agent" && !assignment.assigned_agent_name) {
      setAssignment((prev) => ({ ...prev, assigned_agent_name: agentName }));
    }
  }, [agentName, assignment.assigned_to_type, assignment.assigned_agent_name]);

  useEffect(() => {
    if (matchedCustomer) {
      setForm((prev) => ({ ...prev, name: matchedCustomer.name || prev.name }));
    }
  }, [matchedCustomer]);

  const handlePhoneBlur = () => {
    setLookupPhone(form.phone.trim());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const phone = form.phone.trim();
    if (!phone) {
      setError("טלפון הלקוח הוא שדה חובה");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("יש להזין מספר טלפון תקין");
      return;
    }
    const existing = getCustomerByPhone(phone);
    if (!existing && !form.name.trim()) {
      setError("שם הלקוח נדרש ליצירת לקוח חדש");
      return;
    }
    if (!form.referral_topic.trim()) {
      setError("יש לבחור נושא הפניה");
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
      phone,
      name: form.name.trim(),
      existingCustomer: existing,
      referral_topic: form.referral_topic,
      description: form.description,
      priority: form.priority,
      agent_name: agentName,
      status: "open",
      explicit_assignment: !autoRoute,
      ...(autoRoute ? {} : assignment),
    });
    setForm(emptyForm);
    setLookupPhone("");
    setAutoRoute(true);
    setAssignment({
      assigned_to_type: "agent",
      assigned_agent_name: agentName || "",
      assigned_department_id: null,
    });
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="space-y-2">
        <Label htmlFor="manual-ref-phone" className="m3-label-large">
          טלפון לקוח *
        </Label>
        <div className="relative">
          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            id="manual-ref-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            onBlur={handlePhoneBlur}
            placeholder="050-0000000"
            className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-outline/30 bg-surface-container-lowest shadow-elevation-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            dir="ltr"
          />
        </div>
        {matchedCustomer ? (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <UserCircle className="w-4 h-4 shrink-0" />
            לקוח קיים: {matchedCustomer.name}
          </p>
        ) : lookupPhone.length >= 7 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            לא נמצא לקוח — ייווצר לקוח חדש עם השם שיוזן
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-ref-name" className="m3-label-large">
          שם לקוח {matchedCustomer ? "" : "*"}
        </Label>
        <input
          id="manual-ref-name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={matchedCustomer ? matchedCustomer.name : "שם מלא"}
          readOnly={Boolean(matchedCustomer)}
          className={cn(
            "w-full px-4 py-2.5 rounded-2xl border border-outline/30 bg-surface-container-lowest shadow-elevation-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
            matchedCustomer && "bg-surface-container-low text-on-surface-variant"
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-ref-topic" className="m3-label-large">
          נושא הפניה *
        </Label>
        <ReferralTopicCombobox
          value={form.referral_topic}
          onChange={(referral_topic) => setForm((prev) => ({ ...prev, referral_topic }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-ref-desc" className="m3-label-large">
          תיאור / הערות *
        </Label>
        <Textarea
          id="manual-ref-desc"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="פרטי הבקשה, מה נדרש מהלקוח..."
          className="rounded-2xl min-h-[100px] border-outline/30 bg-surface-container-lowest"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-ref-priority" className="m3-label-large">
          עדיפות
        </Label>
        <select
          id="manual-ref-priority"
          value={form.priority}
          onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-2xl border border-outline/30 bg-surface-container-lowest shadow-elevation-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {REFERRAL_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="m3-label-large">יוצר הפניה</Label>
        <input
          value={agentName || "—"}
          readOnly
          className="w-full px-4 py-2.5 rounded-2xl border border-outline/20 bg-surface-container-low text-sm text-on-surface-variant"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={autoRoute}
          onChange={(e) => setAutoRoute(e.target.checked)}
          className="rounded border-outline/40"
        />
        שיוך אוטומטי לפי נושא (כללי ניתוב)
      </label>

      {autoRoute && form.referral_topic && (
        <p className="text-xs text-primary bg-primary-container/40 border border-outline/20 rounded-xl px-3 py-2">
          {(() => {
            const rule = findRoutingRuleForTopic(form.referral_topic);
            if (!rule) return "לא הוגדר כלל לנושא זה — ישויך לנציג היוצר";
            if (rule.assigned_to_type === "department") {
              return `ישויך אוטומטית למחלקת ${getDepartmentName(rule.assigned_department_id)}`;
            }
            return `ישויך אוטומטית ל${rule.assigned_agent_name}`;
          })()}
        </p>
      )}

      {!autoRoute && (
        <ReferralAssignmentFields
          value={assignment}
          onChange={setAssignment}
          defaultAgentName={agentName}
        />
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="m3-btn-outlined px-4 py-2">
            ביטול
          </button>
        )}
        <button type="submit" disabled={!agentName} className="m3-btn-primary px-5 py-2.5">
          <FolderOpen className="w-4 h-4" />
          פתיחת פניה
        </button>
      </div>
    </form>
  );
}
