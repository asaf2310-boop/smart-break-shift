import React, { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function buildImageAlt(img) {
  const doc = img.documentTitle || img.documentName || "מסמך";
  const page = img.pageNumber != null ? ` — עמוד ${img.pageNumber}` : "";
  return `${doc}${page}`;
}

function buildImageCaption(img) {
  const parts = [
    img.documentTitle || img.documentName || "מסמך",
    img.pageNumber != null ? `עמוד ${img.pageNumber}` : null,
    img.caption || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Thumbnail with click-to-zoom lightbox for knowledge page screenshots.
 */
export default function KnowledgeImageLightbox({ img, className = "" }) {
  const [open, setOpen] = useState(false);
  const src = img?.url || img?.src;
  if (!src) return null;

  const alt = buildImageAlt(img);
  const caption = buildImageCaption(img);

  return (
    <>
      <figure className={`m-0 group ${className}`.trim()}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative block w-full rounded-lg border border-outline/20 overflow-hidden bg-white text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`הגדלת תמונה: ${alt}`}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-56 object-contain bg-white transition-opacity group-hover:opacity-95"
            loading="lazy"
          />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn className="h-3 w-3" />
            לחץ להגדלה
          </span>
        </button>
        <figcaption className="text-[10px] text-on-surface-variant mt-1">{caption}</figcaption>
      </figure>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[min(96vw,56rem)] w-full p-2 sm:p-3 gap-2 border-outline/20"
          dir="rtl"
        >
          <DialogTitle className="text-sm font-semibold pe-8">{caption}</DialogTitle>
          <div className="overflow-auto max-h-[85vh] rounded-lg bg-white border border-outline/15">
            <img
              src={src}
              alt={alt}
              className="w-full h-auto max-h-[82vh] object-contain mx-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
