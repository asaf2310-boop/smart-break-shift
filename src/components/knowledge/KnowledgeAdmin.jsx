import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileUp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  listKnowledgeCategories,
  listKnowledgeDocuments,
  resetKnowledgeToSeed,
  subscribeKnowledgeStore,
  hydrateKnowledgeStore,
} from "@/lib/knowledgeStore";
import {
  getKnowledgeIndexStats,
  rebuildKnowledgeChunkIndex,
  formatEmbeddingError,
  getOpenAiRateLimitRetrySec,
  isOpenAiRateLimited,
} from "@/lib/knowledgeAi";
import { extractTextFromFile, buildPdfDocumentContent } from "@/lib/knowledge/textExtractionService";
import KnowledgePdfPagesPreview from "@/components/knowledge/KnowledgePdfPagesPreview";
import {
  saveKnowledgeDocument,
  removeKnowledgeDocument,
  reprocessKnowledgeDocument,
  formatKnowledgeIngestError,
} from "@/lib/knowledge/documentUploadService";
import {
  shouldUseServerRag,
  listServerDocuments,
  probeServerRagHealth,
} from "@/lib/knowledge/knowledgeClient";

const ACCEPT_UPLOAD =
  ".txt,.md,.html,.htm,.pdf,.docx,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";

export default function KnowledgeAdmin() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "כללי",
    pages: null,
    images: null,
    needsServerOcr: false,
  });
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reprocessingId, setReprocessingId] = useState(null);
  const [indexStats, setIndexStats] = useState(() => getKnowledgeIndexStats());
  const [serverRag, setServerRag] = useState(false);
  const [serverChunkCounts, setServerChunkCounts] = useState({});
  const [totalServerChunks, setTotalServerChunks] = useState(0);

  const refreshServerStats = useCallback(async () => {
    if (!shouldUseServerRag()) return;
    try {
      const data = await listServerDocuments();
      const counts = {};
      for (const doc of data.documents || []) {
        counts[doc.id] = doc.chunkCount ?? 0;
      }
      setServerChunkCounts(counts);
      setTotalServerChunks(data.totalChunks ?? 0);
    } catch {
      // server may be unavailable in local dev
    }
  }, []);

  const refresh = useCallback(() => {
    setDocuments(listKnowledgeDocuments());
    setCategories(listKnowledgeCategories());
    setIndexStats(getKnowledgeIndexStats());
    refreshServerStats();
  }, [refreshServerStats]);

  useEffect(() => {
    setServerRag(shouldUseServerRag());
    hydrateKnowledgeStore().then(refresh);
    if (shouldUseServerRag()) {
      probeServerRagHealth().then((h) => setServerRag(h.pgvector));
    }
    return subscribeKnowledgeStore(refresh);
  }, [refresh]);

  const chunkCount = serverRag ? totalServerChunks : indexStats.chunkCount;

  const getDocChunkCount = (docId) =>
    serverRag ? (serverChunkCounts[docId] ?? 0) : null;

  const notifyIndexResult = (result) => {
    setIndexStats(getKnowledgeIndexStats());
    refreshServerStats();
    if (result?.embeddingError) {
      toast({
        title: "אינדקס נשמר — embeddings חלקיים",
        description: formatEmbeddingError(result.embeddingError, getOpenAiRateLimitRetrySec()),
        variant: "destructive",
      });
      return;
    }
    if (result && !result.embeddingsOk && result.chunkCount > 0 && !serverRag) {
      toast({
        title: "אינדקס נשמר — ללא embeddings",
        description: formatEmbeddingError("openai_not_configured"),
      });
    }
  };

  const handleReindex = async () => {
    if (reindexing) return;
    if (serverRag) {
      setReindexing(true);
      try {
        let total = 0;
        for (const doc of listKnowledgeDocuments()) {
          const result = await reprocessKnowledgeDocument(doc.id, doc);
          total += result?.chunkCount ?? 0;
        }
        refresh();
        toast({
          title: "כל המסמכים עובדו מחדש",
          description: `${total} קטעים ב-pgvector`,
        });
      } catch (err) {
        toast({
          title: "שגיאה",
          description: err.message || "לא ניתן לעבד מחדש",
          variant: "destructive",
        });
      } finally {
        setReindexing(false);
      }
      return;
    }

    if (isOpenAiRateLimited()) {
      const waitSec = getOpenAiRateLimitRetrySec();
      toast({
        title: "מגבלת קצב OpenAI",
        description: formatEmbeddingError("openai_error:429", waitSec),
        variant: "destructive",
      });
      return;
    }
    setReindexing(true);
    try {
      const result = await rebuildKnowledgeChunkIndex({ force: true });
      refresh();
      if (result.embeddingsOk) {
        toast({
          title: "האינדקס נבנה מחדש",
          description: `${result.embeddingCount} embeddings ל-${result.chunkCount} קטעים`,
        });
      } else {
        notifyIndexResult(result);
      }
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לבנות אינדקס", variant: "destructive" });
    } finally {
      setReindexing(false);
    }
  };

  const handleReprocessDoc = async (doc) => {
    if (reprocessingId) return;
    setReprocessingId(doc.id);
    try {
      const result = await reprocessKnowledgeDocument(doc.id, doc);
      refresh();
      toast({
        title: "המסמך עובד מחדש",
        description: `${result?.chunkCount ?? 0} קטעים`,
      });
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן לעבד מחדש",
        variant: "destructive",
      });
    } finally {
      setReprocessingId(null);
    }
  };

  const openCreate = () => {
    setForm({ title: "", content: "", category: categories[0] || "כללי", pages: null, images: null, needsServerOcr: false });
    setDialog({ mode: "create" });
  };

  const openEdit = (doc) => {
    setForm({
      title: doc.title,
      content: doc.content,
      category: doc.category || "כללי",
      pages: doc.pages || null,
      images: doc.images || null,
      needsServerOcr: false,
    });
    setDialog({ mode: "edit", id: doc.id });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const hasPdfPages =
      (form.pages?.length > 0 && form.pages.some((p) => p?.thumbnail || p?.hasThumbnail)) ||
      (dialog?.fileName?.toLowerCase().endsWith(".pdf") && form.pages?.length > 0);
    const content =
      hasPdfPages && form.pages?.length
        ? buildPdfDocumentContent(form.pages, form.title)
        : form.content;
    if (!content?.trim() && !hasPdfPages) {
      toast({ title: "חסר תוכן", description: "יש להזין תוכן או להעלות קובץ", variant: "destructive" });
      return;
    }
    try {
      const { ingestResult, ingestError } = await saveKnowledgeDocument({
        id: dialog.mode === "edit" ? dialog.id : undefined,
        title: form.title,
        content: content || buildPdfDocumentContent(form.pages, form.title),
        category: form.category,
        sourceType: dialog.sourceType || "text",
        fileName: dialog.fileName,
        pages: form.pages,
        images: form.images,
        needsServerOcr: form.needsServerOcr,
      });
      setDialog(null);
      refresh();

      if (ingestError) {
        toast({
          title: ingestResult?.chunkCount ? "נשמר חלקית בשרת" : "נשמר מקומית — שגיאה בשרת",
          description: ingestResult?.chunkCount
            ? `${ingestResult.chunkCount} קטעים נשמרו. ${formatKnowledgeIngestError(ingestError)}`
            : formatKnowledgeIngestError(ingestError),
          variant: "destructive",
        });
        return;
      }

      if (serverRag) {
        toast({
          title: "נשמר בהצלחה",
          description: `${ingestResult?.chunkCount ?? 0} קטעים נשמרו ב-pgvector`,
        });
      } else {
        const result = await rebuildKnowledgeChunkIndex();
        notifyIndexResult(result);
        toast({ title: "נשמר בהצלחה", description: "אינדקס החיפוש עודכן" });
      }
    } catch (err) {
      toast({
        title: "שגיאה",
        description:
          err.message === "title_and_content_required"
            ? "נדרשים כותרת ותוכן"
            : formatKnowledgeIngestError(err),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`למחוק את «${doc.title}»?`)) return;
    try {
      const { serverWarning } = await removeKnowledgeDocument(doc.id);
      refresh();
      if (!serverRag) {
        const result = await rebuildKnowledgeChunkIndex();
        notifyIndexResult(result);
      }
      if (serverWarning) {
        toast({ title: "המסמך נמחק", description: serverWarning });
      } else {
        toast({ title: "המסמך נמחק" });
      }
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message || "לא ניתן למחוק",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;

    setUploading(true);
    try {
      const { text, title, error, pages, images, needsServerOcr } = await extractTextFromFile(file);
      if (error) {
        toast({ title: "שגיאה בהעלאה", description: error, variant: "destructive" });
        return;
      }
      setForm({
        title: title || "מסמך מועלה",
        content: text,
        category: form.category || "כללי",
        pages: pages || null,
        images: images || null,
        needsServerOcr: needsServerOcr === true,
      });
      const thumbCount = pages?.filter((p) => p?.thumbnail).length || 0;
      setDialog({
        mode: "create",
        sourceType: "upload",
        fileName: file.name,
      });
      toast({
        title: "הקובץ נקרא בהצלחה",
        description:
          thumbCount > 0
            ? needsServerOcr
              ? `נשמרו ${thumbCount} עמודים כתמונות. לאחר שמירה יופעל OCR בשרת לחילוץ טקסט עברי.`
              : `נשמרו ${thumbCount} עמודים כתמונות. בדקו את התצוגה ולחצו שמירה.`
            : pages?.length
              ? `${pages.length} עמודים זוהו — בדקו את התוכן ולחצו שמירה`
              : "בדקו את התוכן ולחצו שמירה",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleResetSeed = async () => {
    if (!window.confirm("לאפס את בסיס הידע לנתוני הדמו? פעולה זו תמחק את כל המסמכים הנוכחיים.")) return;
    resetKnowledgeToSeed();
    refresh();
    if (!serverRag) {
      const result = await rebuildKnowledgeChunkIndex();
      notifyIndexResult(result);
    }
    toast({ title: "בסיס הידע אופס לדמו" });
  };

  const hasPdfPages =
    (form.pages?.length > 0 && form.pages.some((p) => p?.thumbnail || p?.hasThumbnail)) ||
    (dialog?.fileName?.toLowerCase().endsWith(".pdf") && form.pages?.length > 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="m3-label-medium">
            {documents.length} מסמכים · {chunkCount} קטעים לחיפוש
          </p>
          {serverRag && (
            <p className="m3-label-medium text-xs opacity-80">
              pgvector פעיל — embeddings וחיפוש בשרת
            </p>
          )}
          {!serverRag && chunkCount > 0 && (
            <p className="m3-label-medium text-xs opacity-80">
              embeddings: {indexStats.embeddingCount}/{chunkCount}
              {indexStats.embeddingsOk
                ? " · חיפוש סמנטי פעיל"
                : " · חיפוש מילות מפתח בלבד (הגדר GEMINI_API_KEY + SUPABASE_SERVICE_ROLE_KEY ב-Vercel)"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReindex}
            disabled={reindexing || documents.length === 0}
            className="m3-btn-outlined disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} />
            {reindexing ? "בונה אינדקס…" : serverRag ? "עיבוד מחדש לכל המסמכים" : "בניית אינדקס מחדש"}
          </button>
          <label
            className={`m3-btn-outlined cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <FileUp className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
            {uploading ? "מעבד קובץ…" : "העלאת מסמך"}
            <input
              type="file"
              accept={ACCEPT_UPLOAD}
              className="sr-only"
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
          <button type="button" onClick={openCreate} className="m3-btn-tonal">
            <Plus className="w-4 h-4" />
            מסמך חדש
          </button>
          <button
            type="button"
            onClick={handleResetSeed}
            className="m3-btn-outlined text-on-surface-variant"
          >
            <RotateCcw className="w-4 h-4" />
            איפוס דמו
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="m3-surface-container p-8 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-on-surface-variant mb-3" />
          <p className="m3-label-large">אין מסמכים עדיין</p>
          <p className="m3-label-medium mt-1">
            הוסף טקסט או העלה קובץ txt, md, html, pdf, docx, png, jpg או webp כדי להתחיל
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc, i) => {
            const docChunks = getDocChunkCount(doc.id);
            const pdfPageCount = doc.pages?.filter((p) => p?.thumbnail)?.length || 0;
            return (
              <motion.li
                key={doc.id}
                id={`doc-${doc.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="m3-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="m3-label-large">{doc.title}</span>
                    {doc.category && (
                      <span className="m3-badge text-[10px] py-0.5">{doc.category}</span>
                    )}
                    {docChunks != null && (
                      <span className="m3-badge text-[10px] py-0.5">{docChunks} קטעים</span>
                    )}
                    {pdfPageCount > 0 && (
                      <span className="m3-badge text-[10px] py-0.5">{pdfPageCount} עמודים</span>
                    )}
                    {doc.sourceType === "upload" && doc.fileName && (
                      <span className="m3-label-medium">· {doc.fileName}</span>
                    )}
                  </div>
                  {pdfPageCount > 0 ? (
                    <p className="m3-label-medium mt-1 text-on-surface-variant">
                      PDF · {pdfPageCount} עמודים (תצוגה ויזואלית)
                    </p>
                  ) : (
                    <p className="m3-label-medium mt-1 line-clamp-2">{doc.content}</p>
                  )}
                  <p className="m3-label-medium mt-1 opacity-70">
                    עודכן {new Date(doc.updatedAt).toLocaleString("he-IL")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {serverRag && (
                    <button
                      type="button"
                      onClick={() => handleReprocessDoc(doc)}
                      disabled={reprocessingId === doc.id}
                      className="m3-btn-outlined py-2 px-3"
                      aria-label="עיבוד מחדש"
                      title="עיבוד מחדש"
                    >
                      <RotateCcw
                        className={`w-4 h-4 ${reprocessingId === doc.id ? "animate-spin" : ""}`}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(doc)}
                    className="m3-btn-outlined py-2 px-3"
                    aria-label="עריכה"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="m3-btn-outlined py-2 px-3 text-destructive border-destructive/40 hover:bg-destructive/10"
                    aria-label="מחיקה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full m3-card p-6 max-h-[90vh] overflow-y-auto ${hasPdfPages ? "max-w-4xl" : "max-w-lg"}`}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="m3-title-large text-lg font-semibold">
                {dialog.mode === "edit" ? "עריכת מסמך" : "מסמך חדש"}
              </h2>
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="m3-label-medium block mb-1">כותרת</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="m3-label-medium block mb-1">קטגוריה</label>
                <input
                  list="knowledge-categories"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <datalist id="knowledge-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="m3-label-medium block mb-1">
                  {hasPdfPages ? "תצוגת עמודים" : "תוכן"}
                </label>
                {hasPdfPages ? (
                  <>
                    <KnowledgePdfPagesPreview pages={form.pages} needsServerOcr={form.needsServerOcr} />
                    <details className="mt-3">
                      <summary className="m3-label-medium cursor-pointer text-on-surface-variant">
                        טקסט מחולץ לחיפוש (אופציונלי)
                      </summary>
                      <textarea
                        value={form.content}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        rows={6}
                        dir="auto"
                        className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary resize-y min-h-[100px] whitespace-pre-wrap"
                      />
                    </details>
                  </>
                ) : (
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    rows={10}
                    dir="auto"
                    className="w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary resize-y min-h-[160px] whitespace-pre-wrap"
                    required
                  />
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setDialog(null)} className="m3-btn-outlined">
                  ביטול
                </button>
                <button type="submit" className="m3-btn-tonal">
                  שמירה
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
