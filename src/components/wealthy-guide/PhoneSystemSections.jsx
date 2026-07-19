import React, { useState } from "react";
import { Lightbulb, X, ZoomIn } from "lucide-react";

export default function PhoneSystemSections({ sections }) {
  const [zoomImage, setZoomImage] = useState(null);

  return (
    <>
      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.number} aria-labelledby={`phone-section-${section.number}`}>
            <h2
              id={`phone-section-${section.number}`}
              className="text-lg sm:text-xl font-bold text-on-surface mb-2 flex items-center gap-2"
            >
              <span className="w-1.5 h-6 bg-primary rounded-full shrink-0" />
              {section.number}. {section.title}
            </h2>
            {section.intro && (
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4 sm:mr-3.5">
                {section.intro}
              </p>
            )}

            <div className="space-y-4">
              {section.steps.map((step, index) => (
                <article
                  key={`${section.number}-${step.name}`}
                  className="rounded-2xl border border-outline/15 bg-surface overflow-hidden"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-on-surface mb-1.5">{step.name}</h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed">
                          {step.description}
                        </p>
                        {step.tip && (
                          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-relaxed">{step.tip}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {step.images?.length > 0 && (
                    <div className="border-t border-outline/10 bg-surface-container-low p-3 sm:p-4 space-y-4">
                      {step.images.map((image, imageIndex) => (
                        <figure
                          key={`${image.url}-${imageIndex}`}
                          className="rounded-xl border border-outline/15 bg-white overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setZoomImage(image)}
                            className="group relative block w-full p-2 sm:p-3 cursor-zoom-in"
                            aria-label={`הגדלת צילום: ${image.alt}`}
                          >
                            <img
                              src={image.url}
                              alt={image.alt}
                              loading="lazy"
                              className="block max-w-full max-h-[34rem] w-auto h-auto mx-auto object-contain"
                            />
                            <span className="absolute left-3 top-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity rounded-full bg-surface/90 shadow px-2.5 py-1.5 text-xs text-on-surface flex items-center gap-1.5">
                              <ZoomIn className="w-3.5 h-3.5 text-primary" />
                              הגדלה
                            </span>
                          </button>
                          <figcaption className="border-t border-outline/10 px-3 py-2 text-xs text-on-surface-variant leading-relaxed">
                            {image.caption}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={zoomImage.alt}
          onClick={() => setZoomImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute left-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20"
            aria-label="סגירת התמונה"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={zoomImage.url}
            alt={zoomImage.alt}
            className="max-w-full max-h-full object-contain rounded-lg bg-white"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
