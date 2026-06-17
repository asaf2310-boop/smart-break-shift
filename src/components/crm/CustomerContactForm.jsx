import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  name: "",
  role_title: "",
  phone: "",
  email: "",
  notes: "",
};

export default function CustomerContactForm({ initial, onSubmit, onCancel, submitLabel = "שמירה" }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        role_title: initial.role_title || "",
        phone: initial.phone || "",
        email: initial.email || "",
        notes: initial.notes || "",
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [initial]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("שם איש הקשר הוא שדה חובה");
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="space-y-2">
        <Label htmlFor="contact-name">שם *</Label>
        <Input id="contact-name" value={form.name} onChange={handleChange("name")} placeholder="שם מלא" className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-role">תפקיד</Label>
        <Input id="contact-role" value={form.role_title} onChange={handleChange("role_title")} placeholder="מנהל, מזכירה..." className="rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact-phone">טלפון</Label>
          <Input id="contact-phone" value={form.phone} onChange={handleChange("phone")} placeholder="050-0000000" className="rounded-xl" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">אימייל</Label>
          <Input id="contact-email" type="email" value={form.email} onChange={handleChange("email")} placeholder="name@company.co.il" className="rounded-xl" dir="ltr" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-notes">הערות</Label>
        <Textarea id="contact-notes" value={form.notes} onChange={handleChange("notes")} placeholder="הערות..." className="rounded-xl min-h-[60px]" />
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
            ביטול
          </Button>
        )}
        <Button type="submit" className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
