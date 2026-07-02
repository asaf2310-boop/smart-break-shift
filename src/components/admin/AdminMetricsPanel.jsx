import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import MetricsPointSettingsPanel from "@/components/admin/MetricsPointSettingsPanel";
import {
  clearAllMetrics,
  importMetricsDataset,
  loadAllMetricsSnapshots,
} from "@/lib/agentMetricsApi";
import {
  downloadMetricsTemplate,
  getCurrentMonthSheetContext,
  getReferenceDateFromPeriodLabel,
  parseMetricsFile,
} from "@/lib/agentMetricsImport";
import { filterMetricsColumns } from "@/lib/agentMetricsFormat";
import { isTeamAverageLabel } from "@/lib/agentMetricsImport";
import { loadMetricsPointSettings } from "@/lib/agentMetricsPointSettings";
import {
  getChannelLabel,
  getMetricsRankingNote,
  getUnifiedRankingNote,
  mergeDisplayColumns,
  METRICS_CHANNEL,
  rankMetricRows,
  rankUnifiedMetricRows,
} from "@/lib/agentMetricsScoring";

function buildRankedPreview(preview, pointSettings) {
  if (!preview?.rows?.length) return [];
  const columns = filterMetricsColumns(preview.columns || []);
  return rankMetricRows(
    preview.rows.map((r) => ({
      agent_name: r.agentName,
      metrics: r.metrics,
      id: r.agentName,
    })),
    columns,
    preview.channel,
    pointSettings
  );
}

export default function AdminMetricsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState({ phone: null, whatsapp: null });
  const [periodLabel, setPeriodLabel] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pointSettings, setPointSettings] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, settings] = await Promise.all([
        loadAllMetricsSnapshots(),
        loadMetricsPointSettings(),
      ]);
      setSnapshots(data);
      setPointSettings(settings);
      const label =
        data.phone?.upload?.period_label || data.whatsapp?.upload?.period_label || "";
      if (label) setPeriodLabel(label);
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

  useEffect(() => {
    const onSettingsChange = async () => {
      setPointSettings(await loadMetricsPointSettings());
    };
    window.addEventListener("metrics-point-settings-changed", onSettingsChange);
    return () => window.removeEventListener("metrics-point-settings-changed", onSettingsChange);
  }, []);

  const previewColumns = useMemo(
    () => filterMetricsColumns(preview?.columns || []),
    [preview?.columns]
  );

  const previewRows = useMemo(
    () => buildRankedPreview(preview, pointSettings),
    [preview, pointSettings]
  );

  const rankingNote = useMemo(
    () =>
      preview
        ? getMetricsRankingNote(previewColumns, preview.channel, pointSettings)
        : "",
    [preview, previewColumns, pointSettings]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSelectedFile(file);
    try {
      const parsed = await parseMetricsFile(file, {
        periodLabel,
        referenceDate: getReferenceDateFromPeriodLabel(periodLabel, new Date()),
      });
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
        description: `זוהה ערוץ: ${getChannelLabel(parsed.channel)} · ${
          parsed.sheetName ? `גיליון «${parsed.sheetName}»` : "בדקו תצוגה מקדימה"
        }`,
      });
      if (parsed.errors?.length) {
        toast({
          title: "אזהרות בקובץ",
          description: `${parsed.errors.length} שורות עם בעיות`,
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
      const channel = preview.channel || METRICS_CHANNEL.phone;
      const result = await importMetricsDataset({
        channel,
        periodLabel: periodLabel.trim(),
        fileName: selectedFile?.name || "",
        columns: preview.columns,
        rows: preview.rows,
        teamSummary: preview.teamSummary || null,
      });
      toast({
        title: "נשמר בהצלחה",
        description: `${getChannelLabel(channel)} · ${result.rowCount} נציגים${
          periodLabel ? ` · ${periodLabel}` : ""
        }`,
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

  const handleClear = async (channel) => {
    const label = channel ? getChannelLabel(channel) : "כל הערוצים";
    if (!window.confirm(`למחוק נתוני מדדים — ${label}?`)) return;
    try {
      await clearAllMetrics(channel || undefined);
      await refresh();
      setPreview(null);
      toast({ title: "נמחק", description: `נתוני ${label} הוסרו` });
    } catch (err) {
      toast({
        title: "מחיקה נכשלה",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const savedPhoneColumns = filterMetricsColumns(snapshots.phone?.columns || []);
  const savedWhatsappColumns = filterMetricsColumns(snapshots.whatsapp?.columns || []);
  const savedUnifiedColumns = mergeDisplayColumns(savedPhoneColumns, savedWhatsappColumns);
  const savedUnifiedRows = rankUnifiedMetricRows({
    phoneRows: (snapshots.phone?.rows || []).filter((r) => !isTeamAverageLabel(r.agent_name)),
    phoneColumns: savedPhoneColumns,
    whatsappRows: (snapshots.whatsapp?.rows || []).filter((r) => !isTeamAverageLabel(r.agent_name)),
    whatsappColumns: savedWhatsappColumns,
    pointSettings,
  });
  const savedRankingNote = getUnifiedRankingNote(pointSettings);

  return (
    <div className="space-y-6" dir="rtl">
      <MetricsPointSettingsPanel />

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 leading-relaxed">
        העלו קובץ Excel לכל ערוץ בנפרד — <strong>טלפון</strong> ו-<strong>WhatsApp</strong>.
        כל הערוצים מוצגים אחר כך באותה טבלה, אבל הדירוג מחושב בתוך כל ערוץ בלבד.
        שמירה מחליפה רק את הדיווח של אותו ערוץ.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Label htmlFor="metrics-period">תווית תקופה (אופציונלי)</Label>
          <Input
            id="metrics-period"
            placeholder='לדוגמה: יוני 2026'
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => downloadMetricsTemplate("phone")}
            >
              <Download className="h-3.5 w-3.5" />
              תבנית טלפון
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => downloadMetricsTemplate("whatsapp")}
            >
              <Download className="h-3.5 w-3.5" />
              תבנית WhatsApp
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
            נוסחאות ציון
          </div>
          <p className="text-xs">
            1. ניקוד גולמי לכל פעולה (שיחה / WhatsApp / מייל / טיקט) לפי ההגדרות למעלה
          </p>
          <p className="text-xs">
            2. נרמול כל מדד ל-0–100 מול הטוב ביותר בחודש
          </p>
          <p className="text-xs">
            3. כפל במשקל האחוזי וסיכום לציון סופי
          </p>
          <p className="text-xs text-slate-500 pt-1">
            גיליון אוטומטי: <strong>{getCurrentMonthSheetContext().hebrewMonth}</strong>
          </p>
        </div>
      </div>

      {preview?.rows?.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                תצוגה מקדימה — {getChannelLabel(preview.channel)} (טרם נשמר)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {preview.sheetName && <span>גיליון: {preview.sheetName} · </span>}
                {preview.rows.length} נציגים · {rankingNote}
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

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">נתונים שמורים במערכת</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-red-700"
              onClick={() => handleClear(METRICS_CHANNEL.phone)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק טלפון
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-red-700"
              onClick={() => handleClear(METRICS_CHANNEL.whatsapp)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-red-800"
              onClick={() => handleClear()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק הכל
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען...
          </div>
        ) : snapshots.phone?.upload || snapshots.whatsapp?.upload ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-violet-950">
                <span>טבלת דירוג מאוחדת</span>
                {periodLabel && <span className="text-xs font-medium text-violet-800/80">· {periodLabel}</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/90">{savedRankingNote}</p>
              <p className="mt-2 text-xs text-violet-900/80">
                עמודת <strong>דירוג בערוץ</strong> מתייחסת רק לנציגים מאותו ערוץ.
              </p>
            </div>

            <AgentMetricsTable
              columns={savedUnifiedColumns}
              rows={savedUnifiedRows}
              showRank
              rankLabel="דירוג בערוץ"
              showChannel
              showCompositeScore
            />
          </div>
        ) : (
          <AgentMetricsTable columns={[]} rows={[]} />
        )}
      </div>
    </div>
  );
}
