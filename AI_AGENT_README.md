# סוכן AI — MVP

סוכן שיחה בעברית עם גישה לנתונים עסקיים מ-Supabase (קריאה בלבד) דרך OpenAI Function Calling.

## משתני סביבה (Vercel)

| משתנה | חובה | תיאור |
|--------|------|--------|
| `OPENAI_API_KEY` | כן | מפתח OpenAI לצ'אט |
| `OPENAI_MODEL` | לא | ברירת מחדל: `gpt-4o-mini` |
| `SUPABASE_URL` | כן | כתובת Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | כן | מפתח שירות — **שרת בלבד**, לשאילתות read-only |

אין להגדיר מפתחות AI ב-`VITE_*`.

## API

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

## טבלאות

הריצו [`supabase/ai_agent_tables.sql`](../supabase/ai_agent_tables.sql) אם הטבלאות חסרות.

מיגרציית מודול נציגים: [`supabase/agent_module_ai_agent.sql`](../supabase/agent_module_ai_agent.sql)

## פרונט

- נתיב: `/ai-agent`
- מודול: `ai_agent` ב-`AgentModulesPicker`

## הרחבה

1. הוסיפו עמודות ל-`ALLOWED_COLUMNS` ב-`server/ai-agent/getBusinessData.js`
2. הוסיפו טבלה ל-`ALLOWED_TABLES` + מיגרציה ב-Supabase
3. עדכנו את `SYSTEM_PROMPT` ב-`server/ai-agent/aiAgentService.js` אם נדרש התנהגות נוספת
