import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import {
  askKnowledgeBase,
  getKnowledgeIndexStats,
  probeOpenAiAvailability,
  rebuildKnowledgeChunkIndex,
  resetOpenAiProbeCache,
} from "@/lib/knowledgeAi";
import { demoModeEnabled } from "@/api/demoClient";
import {
  getKnowledgeDocumentsFingerprint,
  readKnowledgeChunkIndex,
  subscribeKnowledgeStore,
  hydrateKnowledgeStore,
} from "@/lib/knowledgeStore";
import { useToast } from "@/components/ui/use-toast";

function isDebugPanelEnabled() {
  if (typeof window === "undefined") return false;
  if (demoModeEnabled) return true;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

function formatAssistantContent(content) {
  const text = String(content || "").trim();
  if (!text) return [];

  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^\d+[\.\)]\s/.test(l))) {
        return { type: "steps", lines };
      }
      return { type: "text", text: lines.join("\n") };
    });
}

function RetrievalDebugPanel({ debug, expanded, onToggle }) {
  if (!debug) return null;

  return (
    <div className="mt-2 rounded-xl border border-dashed border-outline/25 bg-surface-container-low/80 text-[11px]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-on-surface-variant hover:bg-surface-container-high/50 rounded-xl"
      >
        <span>דיבוג RAG ({debug.retrievalMethod})</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-start" dir="ltr">
          <p>
            <span className="font-semibold">שאלה:</span> {debug.question}
          </p>
          <div>
            <p className="font-semibold mb-1">קטעים שנשלפו:</p>
            <ul className="space-y-1.5 list-none m-0 p-0">
              {debug.retrievedChunks?.map((c, i) => (
                <li key={i} className="rounded-lg bg-card/80 p-2 border border-outline/10">
                  <div>
                    score={c.score} · {c.documentName}
                    {c.pageNumber != null ? ` · p.${c.pageNumber}` : ""}
                    {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                  </div>
                  <div className="opacity-80 mt-0.5">{c.snippet}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">הקשר שנשלח ל-AI:</p>
            <pre className="whitespace-pre-wrap break-words m-0 p-2 rounded-lg bg-card/80 border border-outline/10 max-h-40 overflow-y-auto">
              {debug.contextSent || "(ריק)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, showDebug, onRetry }) {
  const isUser = message.role === "user";
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div
        dir="rtl"
        lang="he"
        className={`knowledge-chat-message max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-surface-container-high text-foreground border border-outline/15 rounded-bl-md"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="space-y-2.5">
            {formatAssistantContent(message.content).map((block, i) =>
              block.type === "steps" ? (
                <ol key={i} className="m-0 ps-5 space-y-1.5 list-decimal">
                  {block.lines.map((line, j) => (
                    <li key={j} className="ps-0.5">
                      {line.replace(/^\d+[\.\)]\s*/, "")}
                    </li>
                  ))}
                </ol>
              ) : (
                <p key={i} className="m-0">
                  {block.text}
                </p>
              ),
            )}
          </div>
        )}
        {!isUser && message.images?.length > 0 && (
          <div className="mt-3 grid gap-2">
            {message.images.map((img) => (
              <figure key={`${img.documentId}-${img.pageNumber}`} className="m-0">
                <img
                  src={img.src}
                  alt={`${img.documentTitle || "מסמך"} — עמוד ${img.pageNumber}`}
                  className="rounded-lg border border-outline/20 max-w-full h-auto bg-white"
                  loading="lazy"
                />
                <figcaption className="text-[10px] text-on-surface-variant mt-1">
                  {img.documentTitle || "מסמך"}
                  {img.pageNumber != null ? ` · עמוד ${img.pageNumber}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {!isUser && message.citations?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-outline/20">
            <p className="m3-label-medium mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              מקורות
            </p>
            <ul className="space-y-1">
              {message.citations.map((c) => (
                <li key={c.documentId} className="text-xs text-on-surface-variant">
                  <span className="font-semibold text-primary">{c.title}</span>
                  {c.pageNumber != null ? ` · עמוד ${c.pageNumber}` : ""}
                  {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                  {c.category ? ` · ${c.category}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isUser && message.mode === "openai" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-80">GPT</p>
        )}
        {!isUser && message.mode === "local_fallback" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-80">תשובה מקומית מהקטעים</p>
        )}
        {!isUser && message.mode === "low_relevance" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-90">
            לא נמצאו קטעים רלוונטים מספיק — נסה לנסח אחרת או להוסיף מילות מפתח מהמסמך.
          </p>
        )}
        {!isUser && message.openAiFailed && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 opacity-90 m-0">
              {message.openAiError || "GPT לא זמין — תשובה מקומית"}
            </p>
            {onRetry && message.retryQuery && (
              <button
                type="button"
                onClick={() => onRetry(message.retryQuery)}
                className="text-[10px] inline-flex items-center gap-1 text-primary hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                נסה שוב עם GPT
              </button>
            )}
          </div>
        )}
        {showDebug && !isUser && message.debug && (
          <RetrievalDebugPanel
            debug={message.debug}
            expanded={debugOpen}
            onToggle={() => setDebugOpen((v) => !v)}
          />
        )}
      </div>
    </motion.div>
  );
}

export default function KnowledgeChat({ compact = false }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "שלום! שאל שאלה על בסיס המסמכים שמנהל המערכת העלה. התשובה תתבסס על קטעים רלוונטיים בלבד, עם ציון מקור.",
      citations: [],
      mode: "system",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const listRef = useRef(null);
  const { toast } = useToast();
  const [chunkCount, setChunkCount] = useState(() => getKnowledgeIndexStats().chunkCount);
  const [embeddingsOk, setEmbeddingsOk] = useState(() => getKnowledgeIndexStats().embeddingsOk);
  const [openAiOn, setOpenAiOn] = useState(false);
  const showDebug = isDebugPanelEnabled();

  useEffect(() => {
    let cancelled = false;

    const refreshChunkCount = () => {
      if (!cancelled) {
        const stats = getKnowledgeIndexStats();
        setChunkCount(stats.chunkCount);
        setEmbeddingsOk(stats.embeddingsOk);
      }
    };

    const syncIndex = async ({ forceRebuild = false } = {}) => {
      await hydrateKnowledgeStore();
      if (cancelled) return;

      const fingerprint = getKnowledgeDocumentsFingerprint();
      const existing = readKnowledgeChunkIndex();
      const indexFresh =
        !forceRebuild &&
        existing?.fingerprint === fingerprint &&
        existing.chunks?.length > 0;

      if (!indexFresh) {
        setIndexing(true);
        try {
          await rebuildKnowledgeChunkIndex();
        } finally {
          if (!cancelled) setIndexing(false);
        }
      }

      refreshChunkCount();
    };

    syncIndex();
    probeOpenAiAvailability().then((p) => {
      if (!cancelled) setOpenAiOn(p.available);
    });

    const unsub = subscribeKnowledgeStore(() => {
      syncIndex();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const submitQuery = async (text, { isRetry = false } = {}) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!isRetry) {
      const userMsg = { id: `u_${Date.now()}`, role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }

    setLoading(true);

    try {
      if (isRetry) resetOpenAiProbeCache();
      const result = await askKnowledgeBase(trimmed);
      if (result.openAiFailed) {
        toast({
          title: "GPT לא זמין",
          description: result.openAiError,
          variant: "destructive",
        });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          images: result.images || [],
          mode: result.mode,
          openAiFailed: result.openAiFailed,
          openAiError: result.openAiError,
          retryQuery: result.openAiFailed ? trimmed : undefined,
          debug: showDebug ? result.debug : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "אירעה שגיאה בעיבוד השאלה. נסה שוב.",
          citations: [],
          mode: "error",
          retryQuery: trimmed,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    await submitQuery(input);
  };

  const handleRetry = (query) => submitQuery(query, { isRetry: true });

  return (
    <div
      className={`flex flex-col ${compact ? "h-full min-h-0" : "min-h-[min(70vh,32rem)]"}`}
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <p className="m3-label-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          {indexing
            ? "מאנדקס מסמכים…"
            : chunkCount > 0
              ? `${chunkCount} קטעי ידע מאונדקסים`
              : "אין תוכן בבסיס הידע"}
        </p>
        {openAiOn ? (
          <span className="m3-badge text-[10px]">GPT פעיל</span>
        ) : (
          <span className="m3-badge text-[10px] opacity-80">ללא GPT · חיפוש מקומי</span>
        )}
        {chunkCount > 0 && !embeddingsOk && (
          <span className="m3-badge text-[10px] opacity-80">ללא embeddings</span>
        )}
      </div>

      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto space-y-3 rounded-2xl bg-surface-container-low/50 border border-outline/15 p-3 sm:p-4 ${
          compact ? "min-h-0" : "min-h-[280px] max-h-[min(55vh,28rem)]"
        }`}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} showDebug={showDebug} onRetry={handleRetry} />
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="knowledge-chat-message rounded-2xl bg-surface-container-high px-4 py-3 flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" />
              מחפש בבסיס הידע...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="שאל שאלה על המדיניות, המוצר או הנהלים..."
          className="flex-1 rounded-2xl border border-outline/25 bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          disabled={loading || chunkCount === 0 || indexing}
          dir="auto"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || chunkCount === 0 || indexing}
          className="m3-btn-tonal shrink-0 px-4 disabled:opacity-50"
          aria-label="שליחה"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
