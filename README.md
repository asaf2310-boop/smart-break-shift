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

ב־Vercel:

- למערכת אמיתית: להגדיר `VITE_SUPABASE_URL` ו־`VITE_SUPABASE_ANON_KEY`.
- לסביבת דמו: להגדיר `VITE_DEMO_MODE=true`.
