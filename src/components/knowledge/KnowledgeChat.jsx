import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Send, Sparkles } from "lucide-react";
import { askKnowledgeBase, getAllChunks, isOpenAiConfigured } from "@/lib/knowledgeAi";

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
            : "bg-surface-container-high text-foreground border border-outline/15 rounded-bl-md"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="space-y-2 whitespace-normal">
            {String(message.content || "")
              .split(/\n{2,}/)
              .map((block) => block.trim())
              .filter(Boolean)
              .map((block, i) => (
                <p key={i} className="m-0">
                  {block.replace(/\n+/g, " ")}
                </p>
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
                  {c.category ? ` · ${c.category}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isUser && message.mode && message.mode !== "no_match" && message.mode !== "system" && (
          <p className="mt-2 text-[10px] text-on-surface-variant opacity-80">
            {message.mode === "openai"
              ? "GPT"
              : message.mode === "template"
                ? "סיכום אוטומטי (דמו)"
                : ""}
          </p>
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
        "שלום! שאל אותי שאלה על בסיס המסמכים שמנהל המערכת העלה. אציג תשובה עם מקורות מהידע השמור.",
      citations: [],
      mode: "system",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const chunkCount = getAllChunks().length;
  const openAiOn = isOpenAiConfigured();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: `u_${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await askKnowledgeBase(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          mode: result.mode,
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
        },
      ]);
    } finally {
      setLoading(false);
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
          {chunkCount > 0 ? `${chunkCount} קטעי ידע זמינים` : "אין תוכן בבסיס הידע"}
        </p>
        {openAiOn ? (
          <span className="m3-badge text-[10px]">OpenAI פעיל</span>
        ) : (
          <span className="m3-badge text-[10px] opacity-80">מצב דמו · ללא API</span>
        )}
      </div>

      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto space-y-3 rounded-2xl bg-surface-container-low/50 border border-outline/15 p-3 sm:p-4 ${
          compact ? "min-h-0" : "min-h-[280px] max-h-[min(55vh,28rem)]"
        }`}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="rounded-2xl bg-surface-container-high px-4 py-3 flex items-center gap-2 text-sm text-on-surface-variant">
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
          disabled={loading || chunkCount === 0}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || chunkCount === 0}
          className="m3-btn-tonal shrink-0 px-4 disabled:opacity-50"
          aria-label="שליחה"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
