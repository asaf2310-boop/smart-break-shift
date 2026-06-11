import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  DEFAULT_METRICS_POINT_SETTINGS,
  loadMetricsPointSettings,
  saveMetricsPointSettings,
} from "@/lib/agentMetricsPointSettings";

const FIELDS = [
  { key: "phoneCall", label: "ניקוד לשיחה טלפונית", step: "0.01" },
  { key: "whatsappCall", label: "ניקוד לשיחת WhatsApp", step: "0.01" },
  { key: "email", label: "ניקוד למייל שטופל", step: "0.01" },
  { key: "ticket", label: "ניקוד לטיקט", step: "0.01" },
];

export default function MetricsPointSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ ...DEFAULT_METRICS_POINT_SETTINGS });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadMetricsPointSettings();
      setValues(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveMetricsPointSettings(values);
      setValues(saved);
      toast({ title: "הגדרות נשמרו", description: "ניקוד הפעולות עודכן — הדירוג יתעדכן אוטומטית" });
    } catch (err) {
      toast({
        title: "שמירה נכשלה",
        description: err.message || "נסו שוב",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Settings2 className="h-4 w-4 text-violet-600" />
          הגדרות ניקוד פעולות (בונוסים)
        </div>
        <Button type="button" size="sm" className="gap-1.5" disabled={saving || loading} onClick={handleSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמור הגדרות
        </Button>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        כל פעולה מומרת לניקוד גולמי (למשל 80 שיחות × {values.phoneCall} ={" "}
        {(80 * values.phoneCall).toFixed(2)}). לאחר מכן כל מדד מנורמל ל-0–100 מול הטוב ביותר בחודש,
        ורק אז מוכפל במשקל האחוזי.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען הגדרות...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`point-${field.key}`} className="text-xs text-slate-600">
                {field.label}
              </Label>
              <Input
                id={`point-${field.key}`}
                type="number"
                min="0"
                step={field.step}
                dir="ltr"
                className="text-left"
                value={values[field.key]}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: e.target.value === "" ? "" : Number.parseFloat(e.target.value),
                  }))
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
