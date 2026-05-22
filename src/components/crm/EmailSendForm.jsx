import React, { useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReferralTopicCombobox } from "@/components/crm/CallLogForm";

export default function EmailSendForm({ customerEmail, agentName, onSubmit }) {
  const [form, setForm] = useState({
    subject: "",
    referral_topic: "",
    body: "",
  });
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerEmail?.trim()) {
      setError("ללקוח אין כתובת מייל — עדכנו את פרטי הלקוח");
      return;
    }
    if (!form.subject.trim()) {
      setError("נושא המייל הוא שדה חובה");
      return;
    }
    if (!form.body.trim()) {
      setError("תיאור הפניה הוא שדה חובה");
      return;
    }
    if (!agentName) {
      setError("יש להתחבר כנציג כדי לשלוח מייל");
      return;
    }
    onSubmit({
      to_email: customerEmail.trim(),
      subject: form.subject,
      body: form.body,
      referral_topic: form.referral_topic || null,
      agent_name: agentName,
      status: "simulated",
    });
    setForm({ subject: "", referral_topic: "", body: "" });
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">
        <Send className="w-4 h-4 text-indigo-600" />
        שליחת מייל ללקוח
      </h3>
      {!agentName && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          יש להתחבר כנציג כדי לשלוח מייל
        </p>
      )}
      {!customerEmail?.trim() && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          אין כתובת מייל ללקוח — הוסיפו מייל בעריכת הלקוח
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email-to">אל</Label>
        <Input
          id="email-to"
          value={customerEmail || ""}
          readOnly
          placeholder="אין מייל"
          className="rounded-xl bg-slate-50"
          dir="ltr"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-subject">נושא *</Label>
        <Input
          id="email-subject"
          value={form.subject}
          onChange={handleChange("subject")}
          placeholder="למשל: עדכון סטטוס בקשה"
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-referral-topic">נושא הפניה (אופציונלי)</Label>
        <ReferralTopicCombobox
          value={form.referral_topic}
          onChange={(referral_topic) => setForm((prev) => ({ ...prev, referral_topic }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-body">תיאור הפניה *</Label>
        <Textarea
          id="email-body"
          value={form.body}
          onChange={handleChange("body")}
          placeholder="תוכן המייל / תיאור הפניה ללקוח..."
          className="rounded-xl min-h-[120px]"
        />
      </div>
      <div className="space-y-2">
        <Label>נציג</Label>
        <Input value={agentName || "—"} readOnly className="rounded-xl bg-slate-50" />
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button
          type="submit"
          disabled={!agentName || !customerEmail?.trim()}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
        >
          <Send className="w-4 h-4 ml-2" />
          שליחת מייל
        </Button>
      </div>
    </form>
  );
}

export function formatEmailDatetime(iso) {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
}
