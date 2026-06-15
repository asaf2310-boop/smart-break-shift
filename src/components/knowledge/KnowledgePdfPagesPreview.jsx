import React from "react";

/** Scrollable grid of rendered PDF page images for admin preview. */
export default function KnowledgePdfPagesPreview({ pages }) {
  const withThumbs = (pages || []).filter((p) => p?.thumbnail);
  if (!withThumbs.length) return null;

  return (
    <div className="space-y-2">
      <p className="m3-label-medium text-on-surface-variant">
        {withThumbs.length} עמודים — תצוגה כמו במקור
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
