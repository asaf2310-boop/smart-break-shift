import React from "react";

/** Scrollable grid of rendered PDF page images for admin preview. */
export default function KnowledgePdfPagesPreview({ pages, needsServerOcr = false }) {
  const allPages = pages || [];
  const withThumbs = allPages.filter((p) => p?.thumbnail);

  if (!allPages.length) return null;

  if (!withThumbs.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-sm text-on-surface-variant">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {allPages.length} עמודים זוהו, אך תצוגת התמונות לא נטענה בדפדפן.
        </p>
        <p className="mt-1">
          {needsServerOcr
            ? "לאחר שמירה המערכת תנסה OCR בשרת (דורש GEMINI_API_KEY ב-Vercel)."
            : "נסו Chrome/Edge עדכני, או ייצוא מחדש של ה-PDF."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="m3-label-medium text-on-surface-variant">
        {withThumbs.length} עמודים — תצוגה כמו במקור
        {needsServerOcr ? " · OCR בשרת לאחר שמירה" : ""}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto p-1">
        {withThumbs.map((p) => (
          <figure
            key={p.pageNumber}
            className="m-0 rounded-xl border border-outline/20 overflow-hidden bg-white shadow-sm"
          >
            <img
              src={p.thumbnail}
              alt={`עמוד ${p.pageNumber}`}
              className="w-full h-auto block"
              loading="lazy"
            />
            <figcaption className="text-xs text-center py-1.5 bg-surface-container-low text-on-surface-variant">
              עמוד {p.pageNumber}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
