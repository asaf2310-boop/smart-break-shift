import React from "react";
import KnowledgeImageLightbox from "@/components/knowledge/KnowledgeImageLightbox";

/** Scrollable grid of rendered PDF page images for admin preview. */
export default function KnowledgePdfPagesPreview({
  pages,
  needsServerOcr = false,
  documentTitle = "",
}) {
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
        {withThumbs.length} עמודים — תצוגה כמו במקור · לחצו «הגדל» לתצוגה מלאה
        {needsServerOcr ? " · OCR בשרת לאחר שמירה" : ""}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto p-1">
        {withThumbs.map((p) => (
          <KnowledgeImageLightbox
            key={p.pageNumber}
            img={{
              src: p.thumbnail,
              documentTitle: documentTitle || "מסמך",
              pageNumber: p.pageNumber,
            }}
            thumbnailMaxHeight="max-h-64"
          />
        ))}
      </div>
    </div>
  );
}
