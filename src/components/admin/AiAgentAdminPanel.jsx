import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { getAgentBearerHeaders } from "@/lib/agentAuthClient";
import { AGENT_MODULES } from "@/constants/agentModules";
import { extractTextFromFile } from "@/lib/knowledgeFileExtract";
import {
  deleteAiAgentDocument,
  fetchAiAgentDocuments,
  ingestAiAgentDocument,
} from "@/lib/aiAgentDocumentsClient";
import {
  AI_AGENT_DOCUMENTS_MIGRATION_FILE,
  AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE,
  AI_AGENT_SCHEMA_MIGRATION_STEPS_HE,
  formatAiAgentSchemaError,
} from "@/lib/aiAgentMigrationHint";

function SchemaMigrationAlert({ steps = AI_AGENT_SCHEMA_MIGRATION_STEPS_HE }) {
  return (
    <div
      className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2"
      role="alert"
    >
      <p className="font-semibold">{AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE}</p>
      <ol className="list-decimal list-inside space-y-1 text-amber-800">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-xs text-amber-700 pt-1">
        קובץ המיגרציה:{" "}
        <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
          {AI_AGENT_DOCUMENTS_MIGRATION_FILE}
        </code>
      </p>
    </div>
  );
}

function StatusRow({ label, ok, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-2 text-sm text-right">
        {detail ? <span className="text-slate-500 text-xs">{detail}</span> : null}
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-label="תקין" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-label="חסר" />
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AiAgentAdminPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError("");
    try {
      const docs = await fetchAiAgentDocuments();
      setDocuments(docs);
    } catch (err) {
      if (isAiAgentSchemaNotMigratedCode(err?.code)) {
        setDocsError(AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE);
      } else {
        setDocsError(err?.message || "לא ניתן לטעון מסמכים");
      }
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const headers = await getAgentBearerHeaders();
        const res = await fetch("/api/ai-agent-status", { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setError(data.message || data.error || "לא ניתן לטעון סטטוס");
          }
          return;
        }
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setError("שגיאת רשת בטעינת סטטוס");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadMessage("");
    try {
      const extracted = await extractTextFromFile(file);
      if (extracted.error) {
        setUploadMessage(extracted.error);
        return;
      }
      if (!extracted.text?.trim()) {
        setUploadMessage("לא נמצא טקסט במסמך. נסו קובץ אחר.");
        return;
      }

      const result = await ingestAiAgentDocument({
        title: extracted.title || file.name,
        content: extracted.text,
        fileName: file.name,
        mimeType: file.type || null,
      });

      setUploadMessage(
        `המסמך "${extracted.title || file.name}" הועלה (${result.chunkCount ?? 0} קטעים)`,
      );
      await loadDocuments();
    } catch (err) {
      setUploadMessage(formatAiAgentSchemaError(err) || "שגיאה בהעלאת המסמך");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`למחוק את "${doc.title}"?`)) return;
    setDeletingId(doc.id);
    try {
      await deleteAiAgentDocument(doc.id);
      await loadDocuments();
    } catch (err) {
      setUploadMessage(err?.message || "שגיאה במחיקה");
    } finally {
      setDeletingId(null);
    }
  }

  const documentsSchemaMissing =
    status?.documents?.schemaOk === false ||
    docsError === AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE;

  const migrationSteps = status?.documents?.migrationSteps || AI_AGENT_SCHEMA_MIGRATION_STEPS_HE;
  const moduleLabel = AGENT_MODULES.ai_agent?.label || "סוכן AI";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">סקירה</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          סוכן AI עונה לנציגים בעברית, שולף נתונים מ-Supabase (קריאה בלבד) ומחפש במסמכי ידע
          שהועלו כאן. מודול:{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">ai_agent</code>
          {" · "}
          <Link to="/admin/users" className="text-primary font-semibold hover:underline">
            ניהול נציגים
          </Link>
        </p>
      </section>

      {documentsSchemaMissing ? (
        <SchemaMigrationAlert steps={migrationSteps} />
      ) : null}

      {status?.aiQuotaWarning || status?.openaiQuotaWarning || status?.geminiQuotaWarning ? (
        <div
          className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
          role="alert"
        >
          <p className="font-semibold">
            אזהרת מכסת {status?.provider === "openai" ? "OpenAI" : "Gemini"}
          </p>
          <p className="mt-1 text-amber-800">
            {status.aiQuotaWarning || status.geminiQuotaWarning || status.openaiQuotaWarning}
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-800">מסמכי ידע</h2>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white text-sm font-semibold px-4 py-2 hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            העלאת מסמך
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <p className="text-sm text-slate-500 mb-4">
          PDF, TXT, MD, DOCX — עד 5MB. הטקסט מאונדקס לחיפוש סמנטי (embeddings) או מילות מפתח.
        </p>

        {uploadMessage ? (
          uploadMessage === AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE ? (
            <div className="mb-4">
              <SchemaMigrationAlert steps={migrationSteps} />
            </div>
          ) : (
            <p
              className={`text-sm mb-4 rounded-xl px-4 py-3 border ${
                uploadMessage.includes("שגיאה") || uploadMessage.includes("לא")
                  ? "text-amber-800 bg-amber-50 border-amber-200"
                  : "text-emerald-800 bg-emerald-50 border-emerald-200"
              }`}
            >
              {uploadMessage}
            </p>
          )
        ) : null}

        {docsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            טוען מסמכים...
          </div>
        ) : docsError ? (
          docsError === AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE ? (
            <SchemaMigrationAlert steps={migrationSteps} />
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {docsError}
            </p>
          )
        ) : documents.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
            אין מסמכים עדיין — העלו PDF או TXT כדי שהסוכן יוכל לשלוף מהם ידע.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/50 hover:bg-slate-50"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.fileName ? `${doc.fileName} · ` : ""}
                      {formatDate(doc.createdAt)}
                      {doc.chunkCount != null ? ` · ${doc.chunkCount} קטעים` : ""}
                      {doc.status && doc.status !== "ready" ? ` · ${doc.status}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deletingId === doc.id}
                  onClick={() => handleDelete(doc)}
                  className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label={`מחק ${doc.title}`}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4">סטטוס שרת</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            בודק הגדרות...
          </div>
        ) : error ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : status ? (
          <div>
            <StatusRow
              label={`ספק צ'אט (${status.provider === "openai" ? "OpenAI" : status.provider === "gemini" ? "Gemini" : "לא מוגדר"})`}
              ok={status.aiConfigured && !status.aiQuotaWarning}
              detail={
                status.aiQuotaWarning
                  ? "מכסה אזלה"
                  : status.aiHealth?.ok === false && status.aiHealth?.message
                    ? status.aiHealth.message
                    : status.chatModel || undefined
              }
            />
            <StatusRow
              label="GEMINI_API_KEY"
              ok={status.geminiConfigured && !status.geminiQuotaWarning}
              detail={
                status.provider === "gemini" && status.geminiQuotaWarning
                  ? "מכסה אזלה"
                  : status.geminiModel || undefined
              }
            />
            <StatusRow
              label="OPENAI_API_KEY (גיבוי)"
              ok={status.openaiConfigured}
              detail={status.openaiModel || undefined}
            />
            <StatusRow label="SUPABASE_URL + SERVICE_ROLE_KEY" ok={status.supabaseConfigured} />
            <StatusRow
              label="Embeddings (חיפוש מסמכים)"
              ok={status.embeddingsConfigured}
            />
            <StatusRow
              label="מסמכי ידע"
              ok={status.documents?.schemaOk !== false}
              detail={
                status.documents?.schemaOk !== false
                  ? `${status.documents?.count ?? 0} מסמכים`
                  : "טבלאות חסרות — ראו הוראות למעלה"
              }
            />
            <StatusRow
              label="Rate limit"
              ok
              detail={`${status.rateLimit?.maxPerHour ?? 30} בקשות/שעה`}
            />
          </div>
        ) : null}
      </section>

      {status?.allowedTables?.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-2">טבלאות מורשות (read-only)</h2>
          <p className="text-sm text-slate-500 mb-4">
            הכלי <code className="text-xs bg-slate-100 px-1 rounded">getBusinessData</code> — שוויון
            בלבד, עד 50 שורות
          </p>
          <div className="space-y-4">
            {status.allowedTables.map((table) => {
              const cols = status.allowedColumns?.[table] || [];
              const tableOk = status.tableStatus?.[table]?.ok;
              return (
                <div key={table} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <code className="text-sm font-bold text-slate-800">{table}</code>
                    {status.tableStatus ? (
                      tableOk ? (
                        <span className="text-xs text-emerald-700 font-semibold">קיימת</span>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold">חסרה / שגיאה</span>
                      )
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
                    {cols.join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            אם טבלה חסרה — הריצו{" "}
            <code className="bg-slate-100 px-1 rounded">supabase/ai_agent_tables.sql</code>
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
        <div className="flex items-start gap-3">
          <Bot className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-1">בדיקת צ&apos;אט</h2>
            <p className="text-sm text-slate-600 mb-3">
              פתחו את ממשק {moduleLabel} כפי שהנציג רואה אותו (דורש מודול או הרשאת מנהל).
            </p>
            <Link
              to="/ai-agent"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white text-sm font-semibold px-4 py-2 hover:bg-violet-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {moduleLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">משתני סביבה (Vercel)</h2>
        <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside marker:text-slate-400">
          <li>
            <code className="text-xs">GEMINI_API_KEY</code> — חובה (צ&apos;אט + embeddings)
          </li>
          <li>
            <code className="text-xs">GEMINI_CHAT_MODEL</code> — אופציונלי (ברירת מחדל: gemini-2.0-flash-lite)
          </li>
          <li>
            <code className="text-xs">AI_PROVIDER</code> — אופציונלי (ברירת מחדל: gemini אם המפתח קיים)
          </li>
          <li>
            <code className="text-xs">OPENAI_API_KEY</code> — אופציונלי (גיבוי אם AI_PROVIDER=openai)
          </li>
          <li>
            <code className="text-xs">SUPABASE_URL</code> +{" "}
            <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> — שרת בלבד
          </li>
        </ul>
      </section>
    </div>
  );
}
