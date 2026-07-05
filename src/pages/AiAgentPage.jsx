import React, { useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { getAgentBearerHeaders } from "@/lib/agentAuthClient";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";

function formatAgentApiError(res, data) {
  if (data?.message) return data.message;
  if (res.status === 500) return "שגיאת שרת — נסו שוב בעוד רגע";
  if (res.status === 503 && data?.error === "ai_not_configured") {
    return "סוכן AI לא מוגדר בשרת (חסר OPENAI_API_KEY ב-Vercel)";
  }
  if (res.status === 401) {
    return data?.error === "unauthorized"
      ? "נדרשת התחברות עם הרשאת סוכן AI — פנו למנהל לעדכון מודול ai_agent"
      : "נדרשת התחברות מחדש";
  }
  if (res.status === 403) return "גישה נדחתה (CORS) — רעננו את הדף ונסו שוב";
  if (res.status === 429) return "יותר מדי בקשות — נסו שוב בעוד כמה דקות";
  return data?.error || "שגיאה בשליחה";
}

export default function AiAgentPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    scrollToBottom();

    try {
      const headers = await getAgentBearerHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = formatAgentApiError(res, data);
        setError(msg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${msg}`, isError: true },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "אין תשובה" },
      ]);
    } catch {
      const msg = "שגיאת רשת — נסו שוב";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}`, isError: true }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <HypPageLayout variant="scheduling" contentClassName="max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6" dir="rtl">
        <div
          className={hypHeaderIconClass(
            "w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-elevation-2",
          )}
        >
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">סוכן AI</h1>
          <p className="text-sm text-slate-500">
            שאלו על לקוחות, תורים, כרטיסים ושירותים — התשובות בעברית
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="mb-4 min-h-[280px] max-h-[50vh] overflow-y-auto rounded-2xl border border-outline/15 bg-surface-container-low p-4 space-y-3"
        dir="rtl"
      >
        {!messages.length && (
          <p className="text-sm text-on-surface-variant text-center py-8">
            לדוגמה: &quot;כמה תורים יש היום?&quot; או &quot;הצג כרטיסים פתוחים&quot;
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[92%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
              msg.role === "user"
                ? "mr-auto rounded-br-md bg-primary text-primary-foreground"
                : msg.isError
                  ? "ml-auto rounded-bl-md border border-amber-200 bg-amber-50 text-amber-900"
                  : "ml-auto rounded-bl-md border border-outline/12 bg-white text-foreground shadow-sm",
            )}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" />
            חושב...
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-amber-800 mb-2" dir="rtl">
          {error}
        </p>
      )}

      <div className="flex gap-2 items-end" dir="rtl">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="הקלידו שאלה..."
          rows={2}
          disabled={loading}
          className="resize-none"
        />
        <Button
          type="button"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="shrink-0"
          aria-label="שליחה"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </HypPageLayout>
  );
}
