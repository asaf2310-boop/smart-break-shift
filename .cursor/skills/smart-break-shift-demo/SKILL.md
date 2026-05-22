---
name: smart-break-shift-demo
description: >-
  Guides demo vs live Supabase modes, local preview scripts, GitHub upload, and
  RUN_IN_SUPABASE.sql for the smart-break-shift call-center app. Use when changing
  VITE_DEMO_MODE, preview-shell, preview-live, upload-to-github, Vercel env vars,
  or Supabase schema/bootstrap.
---

# Smart Break Shift — דמו מול לייב

## מצבי backend

| מצב | משתנה | מקור נתונים | `backendMode` |
|-----|--------|-------------|---------------|
| דמו | `VITE_DEMO_MODE=true` | `localStorage` (`smart-break-shift-demo-store-v1`) | `demo` |
| לייב | Supabase URL + anon key, **ללא** דמו | Supabase | `supabase` |
| חסר | אין מפתחות ואין דמו | שגיאה בעברית | `missing` |

בחירת לקוח: `src/api/client.js` — `createDemoDataClient()` או `createSupabaseDataClient()`.

## הרצה מקומית

**דמו** (נתונים פיקטיביים, ללא Supabase):

```powershell
powershell -ExecutionPolicy Bypass -File .\preview-shell.ps1
```

- יוצר `.env.local` עם `VITE_DEMO_MODE=true` אם חסר
- משתמש ב-Node מ-`..\michalck\.tools\node` אם קיים
- `npm run dev` → `http://localhost:5173`

**לייב** (אותם נתונים כמו Vercel):

```powershell
powershell -ExecutionPolicy Bypass -File .\preview-live.ps1
```

- דורש `.env.local` לפי `.env.live.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- מסיר/מעקף `VITE_DEMO_MODE` לסשן (`false`)
- אזהרה אם `VITE_DEMO_MODE=true` עדיין בקובץ

## פריסה (Vercel)

- **לייב:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **דמו בענן:** `VITE_DEMO_MODE=true`
- אופציונלי: `VITE_ADMIN_PIN`, `VITE_APP_URL`

לפריסה מהירה ללא חשבון — skill `deploy-to-vercel` (סקריפט `deploy.sh`).

## Supabase — סכימה

קובץ יחיד להדבקה ב-SQL Editor:

`supabase/RUN_IN_SUPABASE.sql`

כולל: טבלאות הפסקות/משמרות/חופשות, `agents`, צ'אט, RLS, טריגרים למניעת משבצת מלאה, Realtime (בסוף).

**לא ב-SQL (Dashboard):** Email auth, SMTP, מפתחות API ל-Vercel.

קבצים נוספים: `schema.sql`, `agents_users.sql`, `enable_realtime.sql` — אם מפצלים ידנית.

## העלאה ל-GitHub

`upload-to-github.ps1` — מחליף תוכן repo `asaf2310-boop/smart-break-shift` (ענף `main`) מעץ מקומי.

- מבקש token מקומי (לא נשמר לדיסק)
- מדלג: `.git`, `node_modules`, `dist`, `.env*`, הסקריפט עצמו
- **לא** מחליף הגדרות Vercel/Supabase

## CRM דמו

`src/lib/crmStore.js` + `CrmDashboard` — לקוחות/שיחות מדומים רק ב-`demoModeEnabled`; אירוע `demo-store-changed` לרענון.

## בדיקות לפני שינוי מצב

1. באנר `BackendConfigBanner` / תג "דמו פעיל" בדפים רלוונטיים
2. `demoModeEnabled` ב-`src/api/demoClient.js`
3. אחרי מעבר ל-Supabase: הרץ `RUN_IN_SUPABASE.sql` + Realtime + Auth Email
