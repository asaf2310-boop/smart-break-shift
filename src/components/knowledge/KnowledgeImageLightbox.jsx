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
 * Thumbnail with expand button and click-to-zoom lightbox for knowledge page screenshots.
 */
export default function KnowledgeImageLightbox({
  img,
  className = "",
  thumbnailMaxHeight = "max-h-56",
}) {
  const [open, setOpen] = useState(false);
  const src = img?.url || img?.src;
  if (!src) return null;

  const alt = buildImageAlt(img);
  const caption = buildImageCaption(img);

  const openLightbox = () => setOpen(true);

  return (
    <>
      <figure className={`m-0 group ${className}`.trim()}>
        <div className="relative rounded-lg border border-outline/20 overflow-hidden bg-white">
          <button
            type="button"
            onClick={openLightbox}
            className="block w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            aria-label={`הגדל תמונה: ${alt}`}
          >
            <img
              src={src}
              alt={alt}
              className={`w-full h-auto ${thumbnailMaxHeight} object-contain bg-white transition-opacity group-hover:opacity-95`}
              loading="lazy"
            />
          </button>
          <button
            type="button"
            onClick={openLightbox}
            className="absolute top-2 end-2 z-10 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="הגדל תמונה"
            title="הגדל תמונה"
          >
            <ZoomIn className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">הגדל</span>
          </button>
        </div>
        <figcaption className="text-[10px] text-on-surface-variant mt-1">{caption}</figcaption>
      </figure>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[min(98vw,72rem)] w-full p-2 sm:p-3 gap-2 border-outline/20"
          dir="rtl"
        >
          <DialogTitle className="text-sm font-semibold pe-8">{caption}</DialogTitle>
          <div className="overflow-auto max-h-[88vh] rounded-lg bg-white border border-outline/15 flex items-center justify-center">
            <img
              src={src}
              alt={alt}
              className="w-auto h-auto max-w-full max-h-[85vh] object-contain mx-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
