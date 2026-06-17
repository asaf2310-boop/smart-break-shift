import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  company: "",
  tax_id: "",
  address: "",
  notes: "",
};

export default function CustomerForm({ initial, onSubmit, onCancel, submitLabel = "שמירה" }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        phone: initial.phone || "",
        email: initial.email || "",
        company: initial.company || "",
        tax_id: initial.tax_id || "",
        address: initial.address || "",
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
      setError("שם הלקוח הוא שדה חובה");
      return;
    }
    onSubmit({
      name: form.name,
      phone: form.phone,
      email: form.email,
      company: form.company,
      tax_id: form.tax_id,
      address: form.address,
      notes: form.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="space-y-2">
        <Label htmlFor="crm-name">שם *</Label>
        <Input id="crm-name" value={form.name} onChange={handleChange("name")} placeholder="שם מלא" className="rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="crm-phone">טלפון</Label>
          <Input id="crm-phone" value={form.phone} onChange={handleChange("phone")} placeholder="050-0000000" className="rounded-xl" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="crm-email">אימייל</Label>
          <Input id="crm-email" type="email" value={form.email} onChange={handleChange("email")} placeholder="name@company.co.il" className="rounded-xl" dir="ltr" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="crm-company">חברה (אופציונלי)</Label>
        <Input id="crm-company" value={form.company} onChange={handleChange("company")} placeholder="שם החברה" className="rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="crm-tax-id">ח.פ / ת.ז</Label>
          <Input id="crm-tax-id" value={form.tax_id} onChange={handleChange("tax_id")} placeholder="מספר ח.פ או ת.ז" className="rounded-xl" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="crm-address">כתובת</Label>
          <Input id="crm-address" value={form.address} onChange={handleChange("address")} placeholder="רחוב, עיר" className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="crm-notes">הערות</Label>
        <Textarea id="crm-notes" value={form.notes} onChange={handleChange("notes")} placeholder="הערות פנימיות..." className="rounded-xl min-h-[80px]" />
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
