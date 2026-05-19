# Smart Break Shift

מערכת לניהול הפסקות, אילוצי משמרות, חופשים ושיבוץ שבועי במוקד.

## Backend

המערכת אינה תלויה בשירות חיצוני ייעודי. יש שני מצבי עבודה:

- `Supabase` לפרודקשן.
- `VITE_DEMO_MODE=true` לסביבת דמו עם נתונים פיקטיביים ב־localStorage.

## הרצה מקומית

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
