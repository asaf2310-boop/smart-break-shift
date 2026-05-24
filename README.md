# Smart Break Shift

מערכת לניהול הפסקות, אילוצי משמרות, חופשים ושיבוץ שבועי במוקד.

## Cursor Agent Skills

סקילס לסוכן AI ב-`.cursor/skills/` (Skills IL + פרויקט). רשימה ומתי להפעיל: [`.cursor/skills/README.md`](.cursor/skills/README.md). מוקד UX: `smart-break-shift-ux`, דומיין מוקד: `call-center-hebrew`, דמו/פריסה: `smart-break-shift-demo`.

## Backend

המערכת אינה תלויה בשירות חיצוני ייעודי. יש שני מצבי עבודה:

- `Supabase` לפרודקשן.
- `VITE_DEMO_MODE=true` לסביבת דמו עם נתונים פיקטיביים ב־localStorage.

## הרצה מקומית

**דמו** (נתונים פיקטיביים):

```powershell
powershell -ExecutionPolicy Bypass -File .\preview-shell.ps1
```

**לייב** (אותם נתונים כמו ב-Vercel / Supabase):

```powershell
# 1. צור .env.local לפי .env.live.example (מפתחות מ-Vercel)
# 2. הרץ:
powershell -ExecutionPolicy Bypass -File .\preview-live.ps1
```

```powershell
npm install
npm run dev
```

קובץ `.env.local` לפרודקשן/בדיקות מול Supabase:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

קובץ `.env.local` לדמו מקומי:

```env
VITE_DEMO_MODE=true
```

## פריסה

**שני פרויקטי Vercel מומלצים** (דמו + פרודקשן) על אותו repo `asaf2310-boop/smart-break-shift` — ההפרדה היא במשתני סביבה בזמן build, לא בשני repos. פירוט מלא: [`docs/DEMO_VS_PRODUCTION.md`](docs/DEMO_VS_PRODUCTION.md).

| פרויקט | `VITE_DEMO_MODE` (Production) | חובה גם |
|--------|-------------------------------|---------|
| **smart-break-shift** (לייב) | **לא** — אל תגדיר `true` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **smart-break-shift-demo** (הדגמה) | `true` | אופציונלי |

אחרי שינוי משתני `VITE_*` ב-Vercel — חובה **Redeploy** (הערכים נכנסים רק ב-build חדש).
