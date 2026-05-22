import React, { useState } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReferralTopicCombobox } from "@/components/crm/CallLogForm";

export default function InboundEmailForm({ customerEmail, onSubmit }) {
  const [form, setForm] = useState({
    subject: "",
    referral_topic: "",
    body: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.body.trim()) {
      setError("תוכן המייל הוא שדה חובה");
      return;
    }
    onSubmit({
      from_email: customerEmail || "",
      subject: form.subject,
      body: form.body,
      referral_topic: form.referral_topic || null,
    });
    setForm({ subject: "", referral_topic: "", body: "" });
    setError("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-4"
      dir="rtl"
    >
      <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
        <Inbox className="w-4 h-4" />
        סימולציה: מייל נכנס מהלקוח
      </h4>
      <p className="text-xs text-amber-800">
        לדמו בלבד — רישום תגובת לקוח במייל. אם יש פניה סגורה באותו נושא מלפני פחות מ-7 ימים, היא תיפתח מחדש אצל הנציג המקורי.
      </p>
      <div className="space-y-2">
        <Label htmlFor="inbound-subject">נושא</Label>
        <Input
          id="inbound-subject"
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="למשל: Re: עדכון חשבונית"
          className="rounded-xl bg-white"
        />
      </div>
      <div className="space-y-2">
        <Label>נושא הפניה (לקישור לפתיחה מחדש)</Label>
        <ReferralTopicCombobox
          value={form.referral_topic}
          onChange={(referral_topic) => setForm((prev) => ({ ...prev, referral_topic }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inbound-body">תוכן *</Label>
        <Textarea
          id="inbound-body"
          value={form.body}
          onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          placeholder="מה כתב הלקוח..."
          className="rounded-xl min-h-[80px] bg-white"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <Button type="submit" variant="outline" className="rounded-xl border-amber-300 text-amber-900 hover:bg-amber-100">
        רישום מייל נכנס
      </Button>
    </form>
  );
}
