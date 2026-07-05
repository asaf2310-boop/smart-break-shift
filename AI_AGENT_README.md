# סוכן AI — MVP

סוכן שיחה בעברית עם גישה לנתונים עסקיים מ-Supabase (קריאה בלבד) ולמסמכי ידע (RAG) דרך Function Calling (Gemini ברירת מחדל, OpenAI כגיבוי).

## משתני סביבה (Vercel)

| משתנה | חובה | תיאור |
|--------|------|--------|
| `GEMINI_API_KEY` | כן | מפתח Google AI לצ'אט ו-embeddings — [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_CHAT_MODEL` | לא | ברירת מחדל: `gemini-2.0-flash` |
| `GEMINI_EMBED_MODEL` | לא | ברירת מחדל: `gemini-embedding-001` |
| `GEMINI_EMBED_DIMENSIONS` | לא | ברירת מחדל: `768` (תואם pgvector) |
| `AI_PROVIDER` | לא | `auto` (ברירת מחדל — Gemini אם המפתח קיים), `gemini`, או `openai` |
| `OPENAI_API_KEY` | לא | גיבוי לצ'אט אם `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | לא | ברירת מחדל: `gpt-4o-mini` (רק עם OpenAI) |
| `SUPABASE_URL` | כן | כתובת Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | כן | מפתח שירות — **שרת בלבד**, לשאילתות read-only |

אין להגדיר מפתחות AI ב-`VITE_*`.

## API

### צ'אט

`POST /api/ai-agent`

```json
{ "message": "כמה תורים יש היום?" }
```

תשובה:

```json
{ "reply": "...", "toolRounds": 1 }
```

- דורש JWT נציג עם מודול `ai_agent` (או מנהל)
- Rate limit: 30 בקשות לשעה למשתמש/IP
- ספק ברירת מחדל: **Gemini** (`gemini-2.0-flash`) עם כלי `getBusinessData` ו-`searchDocuments`

### סטטוס (מנהל)

`GET /api/ai-agent-status` — מחזיר `provider` (`gemini` / `openai`), מצב מפתח, מכסה, embeddings, מסמכים.

### ניהול מסמכים (מנהל בלבד)

`GET /api/ai-agent-documents` — רשימת מסמכים

`POST /api/ai-agent-documents`

```json
{
  "action": "ingest",
  "title": "נהלי החזרות",
  "content": "...",
  "fileName": "returns.pdf",
  "mimeType": "application/pdf"
}
```

```json
{ "action": "delete", "documentId": "uuid" }
```

- דורש JWT מנהל (`is_admin`)
- Rate limit: 30 העלאות לשעה
- סוגי קובץ: PDF, TXT, MD, DOCX — עד 5MB תוכן

## כלי `getBusinessData`

פרמטרים:

```ts
{
  table: "customers" | "appointments" | "tickets" | "services",
  filters?: { [column: string]: string | number | boolean },
  limit?: number  // מקסימום 50
}
```

- רק שוויון (`eq`) על עמודות מורשות
- אין SQL חופשי, אין כתיבה/עדכון/מחיקה

## כלי `searchDocuments`

פרמטרים:

```ts
{
  query: string,   // שאילתה בעברית או באנגלית
  topK?: number    // 1–8, ברירת מחדל 5
}
```

- קריאה בלבד — מחפש ב-`ai_agent_document_chunks` (vector) או fallback keyword/fulltext
- הסוכן מסכם בעברית על בסיס הקטעים — לא ממציא

## טבלאות

הריצו [`supabase/ai_agent_tables.sql`](../supabase/ai_agent_tables.sql) אם טבלאות העסק חסרות.

הריצו [`supabase/ai_agent_documents.sql`](../supabase/ai_agent_documents.sql) לבסיס מסמכי הידע (RAG).

מיגרציית מודול נציגים: [`supabase/agent_module_ai_agent.sql`](../supabase/agent_module_ai_agent.sql)

## פרונט

- צ'אט נציג: `/ai-agent`
- ניהול מסמכים (אדמין): `/admin/knowledge/ai-agent`
- מודול: `ai_agent` ב-`AgentModulesPicker`

## זרימת העלאה (אדמין)

1. מנהל נכנס ל-`/admin/knowledge/ai-agent`
2. לוחץ "העלאת מסמך" — PDF / TXT / MD / DOCX
3. הדפדפן מחלץ טקסט (`knowledgeFileExtract.js`)
4. `POST /api/ai-agent-documents` — שמירה ב-`ai_agent_documents` + chunking + embeddings
5. הסוכן משתמש ב-`searchDocuments` כשהנציג שואל על נהלים/מדריכים

## ארכיטקטורה

- `server/ai-agent/aiAgentService.js` — לולאת tool calling (Gemini / OpenAI)
- `server/ai-agent/geminiAgentChat.js` — קריאות Gemini REST + functionDeclarations
- `server/ai-agent/openaiAgentChat.js` — גיבוי OpenAI
- `server/ai/aiProvider.js` — בחירת ספק (`gemini` ברירת מחדל)
- `server/ai/geminiErrors.js` — מיפוי שגיאות Gemini לעברית

## הרחבה

1. הוסיפו עמודות ל-`ALLOWED_COLUMNS` ב-`server/ai-agent/getBusinessData.js`
2. הוסיפו טבלה ל-`ALLOWED_TABLES` + מיגרציה ב-Supabase
3. עדכנו את `SYSTEM_PROMPT` ב-`server/ai-agent/aiAgentService.js` אם נדרש התנהגות נוספת
