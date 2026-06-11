import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Save, Trash2 } from "lucide-react";
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
import {
  downloadMetricsTemplate,
  getCurrentMonthSheetContext,
  parseMetricsFile,
} from "@/lib/agentMetricsImport";
import { filterMetricsColumns } from "@/lib/agentMetricsFormat";
import { getMetricsRankingNote, rankMetricRows } from "@/lib/agentMetricsScoring";

export default function AdminMetricsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const previewColumns = useMemo(
    () => filterMetricsColumns(preview?.columns || []),
    [preview?.columns]
  );

  const savedColumns = useMemo(
    () => filterMetricsColumns(snapshot?.columns || []),
    [snapshot?.columns]
  );

  const previewRows = useMemo(() => {
    if (!preview?.rows?.length) return [];
    return rankMetricRows(
      preview.rows.map((r) => ({
        agent_name: r.agentName,
        metrics: r.metrics,
        id: r.agentName,
      })),
      previewColumns
    );
  }, [preview, previewColumns]);

  const savedRows = useMemo(() => {
    if (!snapshot?.rows?.length) return [];
    return rankMetricRows(snapshot.rows, savedColumns);
  }, [snapshot, savedColumns]);

  const rankingNote = useMemo(
    () => getMetricsRankingNote(previewColumns.length ? previewColumns : savedColumns),
    [previewColumns, savedColumns]
  );

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
      if (parsed.periodLabel) {
        setPeriodLabel(parsed.periodLabel);
      } else if (!periodLabel) {
        const base = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
        setPeriodLabel(base);
      }
      toast({
        title: "קובץ נטען",
        description: parsed.sheetName
          ? `גיליון «${parsed.sheetName}» · בדקו תצוגה מקדימה ולחצו «שמור נתונים»`
          : "בדקו את התצוגה המקדימה ולחצו «שמור נתונים»",
      });
      if (parsed.errors?.length) {
        toast({
          title: "אזהרות בקובץ",
          description: `${parsed.errors.length} שורות עם בעיות — ראו תצוגה מקדימה`,
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

  const handleSave = async () => {
    if (!preview?.rows?.length) {
      toast({
        title: "אין נתונים לשמירה",
        description: "בחרו קובץ Excel תחילה",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const result = await importMetricsDataset({
        periodLabel: periodLabel.trim(),
        fileName: selectedFile?.name || "",
        columns: preview.columns,
        rows: preview.rows,
        teamSummary: preview.teamSummary || null,
      });
      toast({
        title: "נשמר בהצלחה",
        description: `נשמרו ${result.rowCount} נציגים${periodLabel ? ` · ${periodLabel}` : ""}`,
      });
      setPreview(null);
      setSelectedFile(null);
      await refresh();
    } catch (err) {
      toast({
        title: "השמירה נכשלה",
        description: err.message || "נסו שוב",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
        העלו קובץ Excel (.xlsx) או CSV — הנתונים יוצגו בתצוגה מקדימה בלבד.
        לחצו <strong>שמור נתונים</strong> כדי לפרסם לנציגים. כל שמירה מחליפה את הדיווח הקודם.
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
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
            מבנה קובץ מומלץ
          </div>
          <p>שורה ראשונה = כותרות. חובה עמודת <strong>שם נציג</strong>.</p>
          <p className="text-xs">
            קובץ עם מספר גיליונות: המערכת טוענת אוטומטית את גיליון{" "}
            <strong>{getCurrentMonthSheetContext().hebrewMonth}</strong> (החודש הנוכחי).
          </p>
          <p className="text-xs">
            שורת <strong>ממוצע צוות</strong> ב-Excel מוצגת בתחתית הטבלה (לא בדירוג). זמן התחברות ומשך
            שיחה — בדקות.
          </p>
          <p className="text-xs">
            מומלץ לציון משוקלל: <strong>שיחות ממוצע לשעה</strong> (50%) · <strong>תיעוד %</strong> (20%) ·{" "}
            <strong>אי זמינות %</strong> (10%) · <strong>כמות טיפול במיילים</strong> (10%) ·{" "}
            <strong>ממוצע משך שיחה (דק)</strong> (10%)
          </p>
          <p className="text-xs text-violet-800 font-medium">{rankingNote}</p>
        </div>
      </div>

      {preview?.rows?.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">תצוגה מקדימה — טרם נשמר</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {preview.sheetName && <span>גיליון: {preview.sheetName} · </span>}
                {preview.rows.length} נציגים · ממוין מהטוב ביותר · {rankingNote}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "שומר..." : "שמור נתונים"}
            </Button>
          </div>
          <AgentMetricsTable
            columns={previewColumns}
            rows={previewRows}
            teamSummary={preview.teamSummary}
            showRank
            showCompositeScore
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">נתונים שמורים במערכת</h3>
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
              {snapshot.rows.length} נציגים · {rankingNote}
            </p>
            <AgentMetricsTable
              columns={savedColumns}
              rows={savedRows}
              teamSummary={snapshot.upload?.team_summary}
              showRank
              showCompositeScore
            />
          </>
        ) : (
          <AgentMetricsTable columns={[]} rows={[]} />
        )}
      </div>
    </div>
  );
}
