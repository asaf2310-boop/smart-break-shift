import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import TrainingPdfSlideViewer from "@/components/training/TrainingPdfSlideViewer";
import { resolvePresentationSource } from "@/lib/trainingPresentations";

export default function TrainingPresentationShell({ session, open, onClose }) {
  const [source, setSource] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = React.useRef(null);

  useEffect(() => {
    if (!open || !session?.id) {
      setSource(null);
      setLoadError(null);
      setPageNumber(1);
      setPageCount(0);
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setSource(null);
    setPageNumber(1);

    resolvePresentationSource(session.id).then((resolved) => {
      if (cancelled) return;
      if (!resolved) {
        setLoadError("לא הועלה מסמך למפגש זה. מנהל יכול להעלות PDF בניהול הדרכה.");
        return;
      }
      setSource(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [open, session?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") setPageNumber((p) => Math.min(pageCount || p, p + 1));
      if (e.key === "ArrowLeft") setPageNumber((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pageCount]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!open || !session) return null;

  const displayDate = session.displayDate || session.date?.split("-").reverse().join(".");

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={session.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={shellRef}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className={`flex flex-col w-full max-w-4xl mx-auto bg-surface-container-lowest rounded-none sm:rounded-3xl shadow-elevation-3 overflow-hidden ${
              isFullscreen ? "max-w-none h-full rounded-none" : "max-h-[100dvh] sm:max-h-[92vh]"
            }`}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 border-b border-outline-variant/30 bg-gradient-to-l from-primary/8 to-transparent px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-primary font-medium mb-0.5">
                    {displayDate} · {session.timeLabel}
                  </p>
                  <h2 className="m3-title-large text-base sm:text-lg font-semibold leading-snug truncate">
                    {session.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="m3-btn-outlined p-2 shrink-0"
                  aria-label="סגירה"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden bg-surface-container-high/50 flex flex-col">
              {loadError ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <p className="text-sm text-on-surface-variant max-w-sm">{loadError}</p>
                </div>
              ) : source ? (
                <TrainingPdfSlideViewer
                  source={source}
                  pageNumber={pageNumber}
                  onPageCount={setPageCount}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t border-outline-variant/30 px-3 py-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2 bg-surface-container-lowest">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pageNumber <= 1 || !source}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  className="m3-btn-outlined py-2 px-3 disabled:opacity-40"
                  aria-label="שקף קודם"
                >
                  <ChevronRight className="w-4 h-4" />
                  קודם
                </button>
                <button
                  type="button"
                  disabled={!pageCount || pageNumber >= pageCount || !source}
                  onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
                  className="m3-btn-outlined py-2 px-3 disabled:opacity-40"
                  aria-label="שקף הבא"
                >
                  הבא
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm tabular-nums text-on-surface-variant font-medium">
                {pageCount ? `${pageNumber} / ${pageCount}` : "—"}
              </span>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="m3-btn-outlined py-2 px-3"
                aria-label={isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
