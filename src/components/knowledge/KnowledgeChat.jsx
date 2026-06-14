import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { BookOpen, ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, RefreshCw, Send, Sparkles, ThumbsDown } from "lucide-react";
import {
  askKnowledgeBase,
  getKnowledgeIndexStats,
  getOpenAiRateLimitRetrySec,
  isOpenAiRateLimited,
  probeOpenAiAvailability,
  rebuildKnowledgeChunkIndex,
  resetOpenAiProbeCache,
} from "@/lib/knowledgeAi";
import { shouldUseServerRag, probeServerRagHealth, listServerDocuments, submitKnowledgeFeedback } from "@/lib/knowledge/knowledgeClient";
import { demoModeEnabled } from "@/api/demoClient";
import {
  getKnowledgeDocumentsFingerprint,
  readKnowledgeChunkIndex,
  subscribeKnowledgeStore,
  hydrateKnowledgeStore,
  listKnowledgeDocuments,
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

function AssistantMarkdown({ content }) {
  return (
    <ReactMarkdown
      className="knowledge-markdown prose prose-sm max-w-none dark:prose-invert [&_p]:m-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_strong]:font-semibold [&_table]:text-xs"
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
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

function MessageBubble({ message, showDebug, onRetry, onFeedback, feedbackSending }) {
  const isUser = message.role === "user";
  const [debugOpen, setDebugOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const primaryCitation = message.citations?.[0];
  const sourceHref = primaryCitation?.documentId
    ? `/admin/knowledge#doc-${primaryCitation.documentId}`
    : "/admin/knowledge";

  const showConfidenceBadge =
    showDebug || (message.confidence != null && message.confidence < 0.65);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div
        dir="rtl"
        lang="he"
        style={{ unicodeBidi: "embed" }}
        className={`knowledge-chat-message max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-surface-container-high text-foreground border border-outline/15 rounded-bl-md"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
        {!isUser && message.images?.length > 0 && (
          <div className="mt-3 grid gap-2">
            {message.images.map((img, idx) => (
              <figure key={`${img.documentId}-${img.pageNumber}-${idx}`} className="m-0">
                <img
                  src={img.url || img.src}
                  alt={`${img.documentTitle || img.documentName || "מסמך"}${img.pageNumber != null ? ` — עמוד ${img.pageNumber}` : ""}`}
                  className="rounded-lg border border-outline/20 max-w-full h-auto bg-white"
                  loading="lazy"
                />
                <figcaption className="text-[10px] text-on-surface-variant mt-1">
                  {img.documentTitle || img.documentName || "מסמך"}
                  {img.pageNumber != null ? ` · עמוד ${img.pageNumber}` : ""}
                  {img.caption ? ` · ${img.caption}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {!isUser && message.citations?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-outline/20">
            <p className="m3-label-medium mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              מקורות לתשובה
            </p>
            <ul className="space-y-1.5">
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
        {!isUser && message.mode !== "system" && message.mode !== "error" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline/20 hover:bg-surface-container-high/80"
            >
              <Copy className="w-3 h-3" />
              {copied ? "הועתק" : "העתק תשובה"}
            </button>
            {primaryCitation && (
              <a
                href={sourceHref}
                className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline/20 hover:bg-surface-container-high/80 text-primary"
              >
                <ExternalLink className="w-3 h-3" />
                פתח מקור
              </a>
            )}
            {onFeedback && message.userQuestion && (
              <button
                type="button"
                disabled={feedbackSending || message.feedbackSent}
                onClick={() => onFeedback(message)}
                className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-outline/20 hover:bg-surface-container-high/80 disabled:opacity-50"
              >
                <ThumbsDown className="w-3 h-3" />
                {message.feedbackSent ? "המשוב נשלח" : "התשובה לא עזרה"}
              </button>
            )}
            {showConfidenceBadge && message.confidence != null && (
              <span className="text-[10px] m3-badge opacity-90">
                ביטחון: {(message.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {!isUser && (message.mode === "openai" || message.mode === "gemini") && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-80">
            {message.mode === "gemini" ? "Gemini" : "AI"}
          </p>
        )}
        {!isUser && message.mode === "local_fallback" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-80">
            {message.gptSkipped
              ? "תשובה מהמסמכים (GPT מושהה זמנית)"
              : "תשובה מהמסמכים"}
          </p>
        )}
        {!isUser && message.mode === "low_relevance" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-90">
            לא נמצאו קטעים רלוונטים מספיק — נסה לנסח אחרת או להוסיף מילות מפתח מהמסמך.
          </p>
        )}
        {!isUser && message.openAiFailed && !message.gptSkipped && (
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
  const [loadingHint, setLoadingHint] = useState("");
  const [indexing, setIndexing] = useState(false);
  const listRef = useRef(null);
  const { toast } = useToast();
  const [chunkCount, setChunkCount] = useState(() => getKnowledgeIndexStats().chunkCount);
  const [docCount, setDocCount] = useState(() => listKnowledgeDocuments().length);
  const [embeddingsOk, setEmbeddingsOk] = useState(() => getKnowledgeIndexStats().embeddingsOk);
  const [openAiOn, setOpenAiOn] = useState(false);
  const [aiProvider, setAiProvider] = useState(null);
  const [serverRag, setServerRag] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const showDebug = isDebugPanelEnabled();

  useEffect(() => {
    let cancelled = false;

    const refreshChunkCount = () => {
      if (!cancelled) {
        const stats = getKnowledgeIndexStats();
        setChunkCount(stats.chunkCount);
        setEmbeddingsOk(stats.embeddingsOk);
        setDocCount(listKnowledgeDocuments().length);
      }
    };

    const syncIndex = async ({ forceRebuild = false } = {}) => {
      await hydrateKnowledgeStore();
      if (cancelled) return;

      if (shouldUseServerRag()) {
        try {
          const health = await probeServerRagHealth();
          if (!cancelled) {
            setServerRag(health.pgvector);
            setOpenAiOn(health.available);
            setAiProvider(health.provider);
          }
          const data = await listServerDocuments();
          if (!cancelled) {
            setChunkCount(data.totalChunks ?? 0);
            setEmbeddingsOk(health.embeddings);
          }
        } catch {
          if (!cancelled) {
            refreshChunkCount();
          }
        }
        return;
      }

      const fingerprint = getKnowledgeDocumentsFingerprint();
      const existing = readKnowledgeChunkIndex();
      const indexFresh =
        !forceRebuild &&
        existing?.fingerprint === fingerprint &&
        existing.chunks?.length > 0;

      if (!indexFresh && !isOpenAiRateLimited()) {
        setIndexing(true);
        try {
          await rebuildKnowledgeChunkIndex();
        } finally {
          if (!cancelled) setIndexing(false);
        }
      }

      refreshChunkCount();
    };

    let syncTimer = null;
    const debouncedSyncIndex = () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncIndex();
      }, 600);
    };

    syncIndex();
    probeOpenAiAvailability().then((p) => {
      if (!cancelled) setOpenAiOn(p.available && !p.rateLimited);
    });

    const unsub = subscribeKnowledgeStore(() => {
      debouncedSyncIndex();
    });

    return () => {
      cancelled = true;
      clearTimeout(syncTimer);
      unsub();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const submitQuery = async (text, { isRetry = false } = {}) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const hasKnowledge = chunkCount > 0 || docCount > 0;
    if (!hasKnowledge) {
      toast({
        title: "אין תוכן בבסיס הידע",
        description: "מנהל המערכת צריך להעלות מסמכים ב-/admin/knowledge",
        variant: "destructive",
      });
      return;
    }

    if (!isRetry) {
      const userMsg = { id: `u_${Date.now()}`, role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }

    setLoading(true);
    setLoadingHint("");

    try {
      if (isRetry) {
        resetOpenAiProbeCache();
        if (isOpenAiRateLimited()) {
          const waitSec = getOpenAiRateLimitRetrySec();
          if (waitSec > 0) {
            setLoadingHint(`מגבלת קצב OpenAI — ממתין ${waitSec} שניות…`);
            for (let sec = waitSec; sec > 0; sec -= 1) {
              setLoadingHint(`מגבלת קצב OpenAI — ממתין ${sec} שניות…`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      }

      const result = await askKnowledgeBase(trimmed, {
        onPhase: (phase, sec) => {
          if (phase === "searching") setLoadingHint("מחפש בבסיס הידע…");
          else if (phase === "embedding") setLoadingHint("מנתח את השאלה…");
          else if (phase === "gpt") setLoadingHint("מכין תשובה…");
          else if (phase === "fallback_local") setLoadingHint("מחפש במאגר מקומי…");
          else if (phase === "indexing") setLoadingHint("מכין אינדקס מקומי…");
          else if (phase === "waiting_rate_limit") {
            setLoadingHint(`מגבלת קצב OpenAI — ממתין ${sec} שניות…`);
          }
        },
      });
      if (result.openAiFailed && !result.gptSkipped) {
        toast({
          title: result.rateLimited ? "מגבלת קצב AI" : "AI לא זמין",
          description: result.openAiError,
          variant: "destructive",
        });
      } else if (result.gptSkipped && result.gptSkipReason === "rate_limit") {
        toast({
          title: "תשובה מהמסמכים",
          description: "GPT מושהה זמנית — ניתן לנסות שוב בעוד דקה.",
        });
      } else if (result.retriedAfterRateLimit) {
        toast({
          title: "AI חזר לפעול",
          description: "התשובה התקבלה לאחר המתנה קצרה בגלל מגבלת קצב.",
        });
      }
      setOpenAiOn(!result.openAiFailed && (result.mode === "openai" || result.mode === "gemini"));
      if (result.mode === "gemini" || result.mode === "openai") setAiProvider(result.mode);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          sources: result.sources || [],
          images: result.images || [],
          grounded: result.grounded,
          confidence: result.confidence ?? result.debug?.confidence ?? null,
          mode: result.mode,
          userQuestion: trimmed,
          openAiFailed: result.openAiFailed,
          openAiError: result.openAiError,
          gptSkipped: result.gptSkipped,
          gptSkipReason: result.gptSkipReason,
          retryQuery: result.openAiFailed && !result.gptSkipped ? trimmed : undefined,
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
      setLoadingHint("");
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    await submitQuery(input);
  };

  const handleRetry = (query) => submitQuery(query, { isRetry: true });

  const handleFeedback = async (message) => {
    if (feedbackSending || message.feedbackSent) return;
    setFeedbackSending(true);
    try {
      await submitKnowledgeFeedback({
        question: message.userQuestion,
        answer: message.content,
        helpful: false,
        confidence: message.confidence,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, feedbackSent: true } : m)),
      );
      toast({ title: "תודה על המשוב", description: "השאלה נרשמה לבדיקת מנהל." });
    } catch {
      toast({ title: "שגיאה בשליחת משוב", variant: "destructive" });
    } finally {
      setFeedbackSending(false);
    }
  };

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
              : docCount > 0
                ? `${docCount} מסמכים — ממתין לאינדוקס`
                : "אין תוכן בבסיס הידע"}
        </p>
        {openAiOn && !isOpenAiRateLimited() ? (
          <span className="m3-badge text-[10px]">
            {aiProvider === "gemini" ? "Gemini פעיל" : serverRag ? "RAG בשרת" : "AI פעיל"}
          </span>
        ) : isOpenAiRateLimited() ? (
          <span className="m3-badge text-[10px] opacity-80">AI מושהה · חיפוש במסמכים</span>
        ) : (
          <span className="m3-badge text-[10px] opacity-80">חיפוש במסמכים</span>
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
          <MessageBubble
            key={m.id}
            message={m}
            showDebug={showDebug}
            onRetry={handleRetry}
            onFeedback={shouldUseServerRag() ? handleFeedback : undefined}
            feedbackSending={feedbackSending}
          />
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="knowledge-chat-message rounded-2xl bg-surface-container-high px-4 py-3 flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" />
              {loadingHint || "מחפש בבסיס הידע..."}
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
          disabled={loading}
          dir="auto"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="m3-btn-tonal shrink-0 px-4 disabled:opacity-50"
          aria-label="שליחה"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
