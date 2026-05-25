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
  deleteKnowledgeDocument,
  listKnowledgeCategories,
  listKnowledgeDocuments,
  resetKnowledgeToSeed,
  subscribeKnowledgeStore,
  upsertKnowledgeDocument,
} from "@/lib/knowledgeStore";
import { getAllChunks, normalizeHebrewText, sanitizeChunkText } from "@/lib/knowledgeAi";
import { extractTextFromFile } from "@/lib/knowledgeFileExtract";

const ACCEPT_UPLOAD =
  ".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function KnowledgeAdmin() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "כללי",
  });
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(() => {
    setDocuments(listKnowledgeDocuments());
    setCategories(listKnowledgeCategories());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeKnowledgeStore(refresh);
  }, [refresh]);

  const chunkCount = getAllChunks().length;

  const openCreate = () => {
    setForm({ title: "", content: "", category: categories[0] || "כללי" });
    setDialog({ mode: "create" });
  };

  const openEdit = (doc) => {
    setForm({
      title: doc.title,
      content: doc.content,
      category: doc.category || "כללי",
    });
    setDialog({ mode: "edit", id: doc.id });
  };

  const handleSave = (e) => {
    e.preventDefault();
    try {
      upsertKnowledgeDocument({
        id: dialog.mode === "edit" ? dialog.id : undefined,
        title: form.title,
        content: normalizeHebrewText(sanitizeChunkText(form.content)),
        category: form.category,
        sourceType: dialog.sourceType || "text",
        fileName: dialog.fileName,
      });
      setDialog(null);
      refresh();
      toast({ title: "נשמר בהצלחה" });
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message === "title_and_content_required" ? "נדרשים כותרת ותוכן" : "לא ניתן לשמור",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (doc) => {
    if (!window.confirm(`למחוק את «${doc.title}»?`)) return;
    try {
      deleteKnowledgeDocument(doc.id);
      refresh();
      toast({ title: "המסמך נמחק" });
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן למחוק", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;

    setUploading(true);
    try {
      const { text, title, error } = await extractTextFromFile(file);
      if (error) {
        toast({ title: "שגיאה בהעלאה", description: error, variant: "destructive" });
        return;
      }
      setForm({
        title: title || "מסמך מועלה",
        content: text,
        category: form.category || "כללי",
      });
      setDialog({ mode: "create", sourceType: "upload", fileName: file.name });
      toast({ title: "הקובץ נקרא בהצלחה", description: "בדקו את התוכן ולחצו שמירה" });
    } finally {
      setUploading(false);
    }
  };

  const handleResetSeed = () => {
    if (!window.confirm("לאפס את בסיס הידע לנתוני הדמו? פעולה זו תמחק את כל המסמכים הנוכחיים.")) return;
    resetKnowledgeToSeed();
    refresh();
    toast({ title: "בסיס הידע אופס לדמו" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m3-label-medium">
          {documents.length} מסמכים · {chunkCount} קטעים לחיפוש
        </p>
        <div className="flex flex-wrap gap-2">
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
            הוסף טקסט או העלה קובץ txt, md, pdf או docx כדי להתחיל
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc, i) => (
            <motion.li
              key={doc.id}
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
                  {doc.sourceType === "upload" && doc.fileName && (
                    <span className="m3-label-medium">· {doc.fileName}</span>
                  )}
                </div>
                <p className="m3-label-medium mt-1 line-clamp-2">{doc.content}</p>
                <p className="m3-label-medium mt-1 opacity-70">
                  עודכן {new Date(doc.updatedAt).toLocaleString("he-IL")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
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
          ))}
        </ul>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg m3-card p-6 max-h-[90vh] overflow-y-auto"
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
                <label className="m3-label-medium block mb-1">תוכן</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={10}
                  className="w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary resize-y min-h-[160px]"
                  required
                />
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
