import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm";

export default function TrainingSessionDialog({ open, mode, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    deckUrl: "",
    isBreak: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: initial?.title ?? "",
      date: initial?.date ?? format(new Date(), "yyyy-MM-dd"),
      startTime: initial?.startTime ?? "09:00",
      endTime: initial?.endTime ?? "10:00",
      description: initial?.description ?? "",
      deckUrl: initial?.deckUrl ?? "",
      isBreak: Boolean(initial?.isBreak),
    });
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      // parent shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-session-dialog-title"
      onClick={onClose}
    >
      <div
        className="m3-card w-full max-w-md p-5 rounded-2xl shadow-elevation-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="training-session-dialog-title" className="m3-title-large text-lg font-semibold">
            {mode === "edit" ? "עריכת מפגש" : "מפגש חדש"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="m3-btn-outlined p-2 shrink-0"
            aria-label="סגירה"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="ts-title" className="text-xs font-medium text-on-surface-variant block mb-1">
              כותרת *
            </label>
            <input
              id="ts-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label htmlFor="ts-date" className="text-xs font-medium text-on-surface-variant block mb-1">
                תאריך *
              </label>
              <input
                id="ts-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ts-start" className="text-xs font-medium text-on-surface-variant block mb-1">
                התחלה *
              </label>
              <input
                id="ts-start"
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ts-end" className="text-xs font-medium text-on-surface-variant block mb-1">
                סיום *
              </label>
              <input
                id="ts-end"
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ts-desc" className="text-xs font-medium text-on-surface-variant block mb-1">
              תיאור (אופציונלי)
            </label>
            <textarea
              id="ts-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="ts-deck" className="text-xs font-medium text-on-surface-variant block mb-1">
              קישור למצגת (אופציונלי)
            </label>
            <input
              id="ts-deck"
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={form.deckUrl}
              onChange={(e) => setForm((f) => ({ ...f, deckUrl: e.target.value }))}
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isBreak}
              onChange={(e) => setForm((f) => ({ ...f, isBreak: e.target.checked }))}
              className="rounded border-outline-variant"
            />
            הפסקה (ללא מצגת)
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={saving} className="m3-btn-primary text-sm py-2 flex-1 min-w-[8rem]">
              {saving ? "שומר…" : "שמירה"}
            </button>
            <button type="button" onClick={onClose} className="m3-btn-outlined text-sm py-2">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
