import React, { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2 } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

async function loadPdfDocument(source) {
  if (source.kind === "blob") {
    const data = await source.blob.arrayBuffer();
    return pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
  }
  return pdfjsLib.getDocument({ url: source.url, useWorkerFetch: true, isEvalSupported: false }).promise;
}

export default function TrainingPdfSlideViewer({ source, pageNumber, onPageCount }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pdfRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pdfRef.current = null;

    (async () => {
      try {
        const pdf = await loadPdfDocument(source);
        if (cancelled) return;
        pdfRef.current = pdf;
        onPageCount?.(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "לא ניתן לטעון את המסמך");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [source, onPageCount]);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || pageNumber < 1) return;

    renderTaskRef.current?.cancel?.();

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const parent = canvas.parentElement;
    const maxWidth = parent?.clientWidth ? parent.clientWidth - 8 : viewport.width;
    const scale = Math.min(maxWidth / viewport.width, 2);
    const scaled = page.getViewport({ scale });

    const context = canvas.getContext("2d");
    canvas.height = scaled.height;
    canvas.width = scaled.width;

    const task = page.render({ canvasContext: context, viewport: scaled });
    renderTaskRef.current = task;
    await task.promise;
  }, [pageNumber]);

  useEffect(() => {
    if (!pdfRef.current || loading || error) return;
    renderPage().catch(() => {
      setError("שגיאה בהצגת העמוד");
    });
  }, [pageNumber, loading, error, renderPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 text-on-surface-variant">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm">טוען מצגת…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[240px] p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center w-full overflow-auto p-2 sm:p-4">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded-lg shadow-elevation-2 bg-white"
        role="img"
        aria-label={`שקף ${pageNumber}`}
      />
    </div>
  );
}
