import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { fetchKnowledgeDocumentView, shouldUseServerRag } from "@/lib/knowledge/knowledgeClient";
import { getKnowledgeDocument } from "@/lib/knowledgeStore";
import { m3PageClass } from "@/lib/hypPage";

function normalizePages(pages = []) {
  return (pages || [])
    .filter((p) => p?.thumbnail || p?.hasThumbnail)
    .map((p) => ({
      pageNumber: p.pageNumber ?? p.page_number ?? null,
      thumbnail: p.thumbnail || null,
      sectionTitle: p.sectionTitle || (p.pageNumber != null ? `עמוד ${p.pageNumber}` : null),
      text: p.text || "",
      hasThumbnail: Boolean(p.thumbnail || p.hasThumbnail),
    }));
}

export default function KnowledgeDocumentViewPage() {
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const focusPage = Number(searchParams.get("page") || "");
  const pageRefs = useRef({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (shouldUseServerRag()) {
          const data = await fetchKnowledgeDocumentView(documentId);
          if (cancelled) return;
          setDoc(data.document);
          setPages(normalizePages(data.pages));
          return;
        }

        const local = getKnowledgeDocument(documentId);
        if (!local) {
          setError("המסמך לא נמצא");
          return;
        }
        setDoc(local);
        setPages(normalizePages(local.pages));
      } catch (err) {
        if (!cancelled) setError(err?.message || "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!focusPage || loading) return;
    const el = pageRefs.current[focusPage];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusPage, loading, pages]);

  const hasText = useMemo(() => Boolean(String(doc?.content || "").trim()), [doc]);

  return (
    <div className={m3PageClass("pt-app-nav min-h-screen")} dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="m3-headline-small text-lg font-semibold truncate">
                {doc?.title || "מסמך ידע"}
              </h1>
              <p className="m3-label-medium text-on-surface-variant truncate">
                {doc?.fileName || doc?.category || "בסיס ידע"}
              </p>
            </div>
          </div>
          <Link to="/knowledge" className="m3-btn-outlined text-xs py-2 shrink-0">
            <ArrowRight className="w-4 h-4" />
            חזרה לצ&apos;אט
          </Link>
        </div>

        {loading && (
          <div className="m3-card p-8 flex items-center justify-center gap-2 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
            טוען מסמך…
          </div>
        )}

        {!loading && error && (
          <div className="m3-card p-6 text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && doc && (
          <div className="space-y-6">
            {pages.length > 0 && (
              <section className="m3-card p-4 sm:p-6">
                <h2 className="m3-title-medium mb-4">עמודי המסמך</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pages.map((p) => (
                    <figure
                      key={p.pageNumber}
                      ref={(el) => {
                        if (p.pageNumber != null) pageRefs.current[p.pageNumber] = el;
                      }}
                      className="m-0 rounded-xl border border-outline/20 overflow-hidden bg-white shadow-sm scroll-mt-24"
                    >
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={`עמוד ${p.pageNumber}`}
                          className="w-full h-auto block"
                          loading="lazy"
                        />
                      ) : (
                        <div className="p-6 text-sm text-on-surface-variant text-center">
                          אין תצוגה לעמוד {p.pageNumber}
                        </div>
                      )}
                      <figcaption className="text-xs text-center py-1.5 bg-surface-container-low text-on-surface-variant">
                        עמוד {p.pageNumber}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {hasText && (
              <section className="m3-card p-4 sm:p-6">
                <h2 className="m3-title-medium mb-4">תוכן המסמך</h2>
                <div className="knowledge-markdown agent-response-container prose prose-sm max-w-none">
                  <ReactMarkdown>{doc.content}</ReactMarkdown>
                </div>
              </section>
            )}

            {!hasText && !pages.length && (
              <div className="m3-card p-6 text-sm text-on-surface-variant">
                אין תוכן להצגה במסמך זה.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
