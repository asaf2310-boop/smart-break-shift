import React from "react";

/** Horizontal scroll wrapper for 6-column shift schedule grids on narrow screens. */
export default function ScheduleGridScroll({ gridRef, children, className = "" }) {
  return (
    <div
      ref={gridRef}
      className={`rounded-2xl border border-slate-100 overflow-x-auto overscroll-x-contain touch-pan-x mb-4 -mx-1 px-1 sm:mx-0 sm:px-0 ${className}`.trim()}
    >
      <div className="min-w-[42rem]">{children}</div>
    </div>
  );
}
