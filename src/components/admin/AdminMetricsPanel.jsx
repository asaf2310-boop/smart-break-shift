import React, { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import {
  clearAllMetrics,
  importMetricsDataset,
  loadLatestMetrics,
} from "@/lib/agentMetricsApi";
import { downloadMetricsTemplate, parseMetricsFile } from "@/lib/agentMetricsImport";

export default function AdminMetricsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadLatestMetrics();
      setSnapshot(data);
      if (data?.upload?.period_label) setPeriodLabel(data.upload.period_label);
    } catch (err) {
      toast({
        title: "שגיאה בטעינה",
        description: err.message || "לא ניתן לטעון מדדים",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSelectedFile(file);
    try {
      const parsed = await parseMetricsFile(file);
      if (parsed.errors?.length && !parsed.rows?.length) {
        toast({
          title: "קובץ לא תקין",
          description: parsed.errors.join(" · "),
          variant: "destructive",
        });
        setPreview(null);
        return;
      }
      setPreview(parsed);
      if (!periodLabel) {
        const base = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
        setPeriodLabel(base);
      }
      if (parsed.errors?.length) {
        toast({
          title: "תצוגה מקדימה",
          description: `נמצאו ${parsed.rows.length} שורות · ${parsed.errors.length} אזהרות`,
        });
      }
    } catch (err) {
      toast({
        title: "לא ניתן לקרוא את הקובץ",
        description: err.message || "בדקו שזה קובץ Excel או CSV תקין",
        variant: "destructive",
      });
      setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!preview?.rows?.length) {
      toast({
        title: "אין נתונים",
        description: "בחרו קובץ Excel עם שם נציג ומדדים",
        variant: "destructive",
      });
      return;
    }
    setImporting(true);
    try {
      const result = await importMetricsDataset({
        periodLabel: periodLabel.trim(),
        fileName: selectedFile?.name || "",
        columns: preview.columns,
        rows: preview.rows,
      });
      toast({
        title: "המדדים עודכנו",
        description: `יובאו ${result.rowCount} שורות${periodLabel ? ` · ${periodLabel}` : ""}`,
      });
      setPreview(null);
      setSelectedFile(null);
      await refresh();
    } catch (err) {
      toast({
        title: "הייבוא נכשל",
        description: err.message || "נסו שוב",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("למחוק את כל נתוני המדדים?")) return;
    try {
      await clearAllMetrics();
      setSnapshot(null);
      setPreview(null);
      toast({ title: "נמחק", description: "נתוני המדדים הוסרו" });
    } catch (err) {
      toast({
        title: "מחיקה נכשלה",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 leading-relaxed">
        העלו קובץ Excel (.xlsx) או CSV עם עמודת <strong>שם נציג</strong> ועמודות מדדים נוספות.
        כל העלאה מחליפה את הנתונים הקודמים. הנציגים רואים את הטבלה במסך «מדדים».
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Label htmlFor="metrics-period">תווית תקופה (אופציונלי)</Label>
          <Input
            id="metrics-period"
            placeholder='לדוגמה: יוני 2026 / שבוע 23'
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
          />
          <Label htmlFor="metrics-file" className="block pt-1">
            קובץ Excel / CSV
          </Label>
          <Input
            id="metrics-file"
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={downloadMetricsTemplate}>
              <Download className="h-3.5 w-3.5" />
              הורד תבנית
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-violet-600 hover:bg-violet-700"
              disabled={!preview?.rows?.length || importing}
              onClick={handleImport}
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing ? "מייבא..." : "עדכן מדדים"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
            מבנה קובץ מומלץ
          </div>
          <p>שורה ראשונה = כותרות. עמודה ראשונה (או «שם נציג») = שם הנציג כפי שמופיע במערכת.</p>
          <p className="text-xs">דוגמה: שיחות · זמן ממוצע · עמידה ביעד % · ציון שביעות רצון</p>
          {preview?.rows?.length > 0 && (
            <p className="text-teal-800 font-medium pt-1">
              תצוגה מקדימה: {preview.rows.length} נציגים · {preview.columns.length - 1} מדדים
            </p>
          )}
        </div>
      </div>

      {preview?.rows?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">תצוגה מקדימה לפני שמירה</h3>
          <AgentMetricsTable columns={preview.columns} rows={preview.rows.map((r) => ({
            agent_name: r.agentName,
            metrics: r.metrics,
            id: r.agentName,
          }))} />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">נתונים פעילים במערכת</h3>
          {snapshot?.upload && (
            <Button type="button" variant="outline" size="sm" className="gap-1 text-red-700" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5" />
              מחק הכל
            </Button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען...
          </div>
        ) : snapshot?.rows?.length ? (
          <>
            <p className="text-xs text-slate-500">
              {snapshot.upload?.period_label && (
                <span>תקופה: {snapshot.upload.period_label} · </span>
              )}
              עודכן:{" "}
              {snapshot.upload?.uploaded_at
                ? new Date(snapshot.upload.uploaded_at).toLocaleString("he-IL")
                : "—"}
              {snapshot.upload?.file_name && ` · ${snapshot.upload.file_name}`}
              {" · "}
              {snapshot.rows.length} נציגים
            </p>
            <AgentMetricsTable columns={snapshot.columns} rows={snapshot.rows} />
          </>
        ) : (
          <AgentMetricsTable columns={[]} rows={[]} />
        )}
      </div>
    </div>
  );
}
