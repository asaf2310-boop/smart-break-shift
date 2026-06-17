import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOMER_PRODUCT_STATUSES } from "@/lib/crmStore";

const emptyForm = {
  product_name: "",
  product_code: "",
  status: "active",
  notes: "",
};

export default function CustomerProductForm({ initial, onSubmit, onCancel, submitLabel = "שמירה" }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        product_name: initial.product_name || "",
        product_code: initial.product_code || "",
        status: initial.status || "active",
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
    if (!form.product_name.trim()) {
      setError("שם המוצר הוא שדה חובה");
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="space-y-2">
        <Label htmlFor="product-name">שם מוצר *</Label>
        <Input id="product-name" value={form.product_name} onChange={handleChange("product_name")} placeholder="שם המוצר" className="rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="product-code">קוד מוצר</Label>
          <Input id="product-code" value={form.product_code} onChange={handleChange("product_code")} placeholder="SKU / קוד" className="rounded-xl" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-status">סטטוס</Label>
          <select
            id="product-status"
            value={form.status}
            onChange={handleChange("status")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {CUSTOMER_PRODUCT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="product-notes">הערות</Label>
        <Textarea id="product-notes" value={form.notes} onChange={handleChange("notes")} placeholder="הערות..." className="rounded-xl min-h-[60px]" />
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
