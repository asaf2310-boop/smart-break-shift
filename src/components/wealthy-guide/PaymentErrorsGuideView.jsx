import React, { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, FileDown, Info, Search, X } from "lucide-react";
import WealthyGuideSmsDialog from "@/components/wealthy-guide/WealthyGuideSmsDialog";
import { wealthyGuidePath } from "@/lib/wealthyGuideConfig";

/**
 * Shared searchable RTL error-code table for Shva / 3DS guides.
 */
export default function PaymentErrorsGuideView({
  breadcrumbParent = "שגיאות תשלום",
  title,
  subtitle,
  intro,
  sourcesNote,
  icon: Icon = AlertTriangle,
  errors,
  groupByCategory = false,
  categoryLabels = {},
  guideType,
  onExportPdf,
  showSms = true,
}) {
  const [query, setQuery] = useState("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferredQuery) return errors;
    return errors.filter((err) => {
      const hay = `${err.code} ${err.description} ${err.tip || ""} ${err.category || ""}`.toLowerCase();
      return hay.includes(deferredQuery);
    });
  }, [errors, deferredQuery]);

  const groups = useMemo(() => {
    if (!groupByCategory) return [{ key: "all", label: null, items: filtered }];
    const map = new Map();
    for (const err of filtered) {
      const key = err.category || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(err);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: categoryLabels[key] || key,
      items,
    }));
  }, [filtered, groupByCategory, categoryLabels]);

  const handleExport = async () => {
    if (!onExportPdf || exportingPdf) return;
    setExportingPdf(true);
    try {
      await onExportPdf();
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="pb-12 min-w-0" dir="rtl">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant mb-4">
          <Link to={wealthyGuidePath()} className="hover:text-primary transition-colors">
            הדרכה
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span>{breadcrumbParent}</span>
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="text-primary font-medium">{title}</span>
        </div>

        <div className="flex flex-col gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">{title}</h1>
              {subtitle && <p className="text-on-surface-variant text-sm mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
            {showSms && guideType && (
              <button
                type="button"
                onClick={() => setShowSmsDialog(true)}
                className="m3-btn-outlined text-sm py-2.5 flex items-center justify-center gap-2 w-full lg:w-auto"
              >
                שלח קישור ב-SMS
              </button>
            )}
            {onExportPdf && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exportingPdf}
                className="m3-btn-filled text-sm py-2.5 flex items-center justify-center gap-2 w-full sm:col-span-2 lg:col-span-1 lg:w-auto disabled:opacity-60"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                {exportingPdf ? "מייצא..." : "ייצוא ל-PDF"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-on-surface-variant leading-relaxed">{intro}</p>
          </div>
        </div>

        {sourcesNote && (
          <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-4">{sourcesNote}</p>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי קוד או תיאור..."
            className="w-full rounded-xl border border-outline/20 bg-surface py-2.5 pr-10 pl-10 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="חיפוש קודי שגיאה"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface-container text-on-surface-variant"
              aria-label="נקה חיפוש"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          מציג {filtered.length} מתוך {errors.length} קודים
        </p>
      </motion.div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.key}>
            {group.label && (
              <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                {group.label}
                <span className="text-xs text-on-surface-variant font-normal mr-1">
                  ({group.items.length})
                </span>
              </h2>
            )}

            {group.items.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-8 text-center">לא נמצאו קודים תואמים לחיפוש.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-outline/15 bg-surface">
                <table className="w-full min-w-[520px] text-sm text-right">
                  <thead>
                    <tr className="bg-surface-container/60 border-b border-outline/15">
                      <th className="px-3 py-2.5 font-semibold text-on-surface w-24">קוד</th>
                      <th className="px-3 py-2.5 font-semibold text-on-surface">תיאור</th>
                      <th className="px-3 py-2.5 font-semibold text-on-surface w-[40%]">טיפ לנציג</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((err) => (
                      <tr
                        key={`${err.category || ""}-${err.code}`}
                        className="border-b border-outline/10 last:border-0 hover:bg-primary/[0.03] align-top"
                      >
                        <td className="px-3 py-2.5">
                          <code className="inline-block font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                            {err.code}
                          </code>
                        </td>
                        <td className="px-3 py-2.5 text-on-surface leading-relaxed">{err.description}</td>
                        <td className="px-3 py-2.5 text-on-surface-variant leading-relaxed text-xs sm:text-sm">
                          {err.tip || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      {showSms && guideType && (
        <WealthyGuideSmsDialog
          open={showSmsDialog}
          onClose={() => setShowSmsDialog(false)}
          guideType={guideType}
        />
      )}
    </div>
  );
}
