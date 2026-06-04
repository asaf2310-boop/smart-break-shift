# אחסון מצגות הדרכה (`training-docs`)

שגיאת **Bucket not found** בפרודקשן פירושה: Supabase מחובר (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) אבל bucket האחסון `training-docs` עדיין לא נוצר בפרויקט.

## שם ה-bucket בקוד

| קובץ | ערך |
|------|-----|
| `src/lib/trainingPresentations.js` | `TRAINING_DOCS_BUCKET = "training-docs"` |
| `src/lib/trainingDocStore.js` | IndexedDB מקומי (גיבוי / דמו) — **לא** שם bucket |
| `uploadTrainingPresentation` | מעלה ל-`{sessionId}.pdf` בתוך `training-docs` |

## יצירת ה-bucket — Supabase Dashboard (מומלץ למנהל)

1. התחברו ל-[Supabase Dashboard](https://supabase.com/dashboard) ובחרו את **פרויקט הפרודקשן** (אותו פרויקט שמופיע ב-`VITE_SUPABASE_URL`).
2. בתפריט השמאלי: **Storage**.
3. **New bucket**:
   - **Name:** `training-docs` (בדיוק, ללא רווחים).
   - **Public bucket:** מופעל (✓) — נציגים קוראים PDF ב-`/training` דרך URL ציבורי.
4. **Create bucket**.
5. **Policies** (אם לא מריצים SQL):
   - **SELECT** ל-`public` על `bucket_id = 'training-docs'`.
   - **INSERT**, **UPDATE**, **DELETE** ל-`anon` על אותו bucket (האפליקציה משתמשת ב-anon key).
6. בדיקה: העלו קובץ PDF קטן ידנית ב-Dashboard תחת `training-docs`, או העלו שוב מ-`/admin/training`.

## יצירה ב-SQL Editor (אוטומטי + מדיניות)

1. **SQL Editor** → **New query**.
2. הדביקו והריצו את כל הקובץ: [`supabase/training_docs_storage.sql`](../supabase/training_docs_storage.sql).
3. ודאו ב-**Storage** שה-bucket `training-docs` מופיע ומסומן Public.

## אחרי יצירת ה-bucket

- העלאה חוזרת מ-`/admin/training` — הקובץ נשמר בענן וכל הנציגים רואים אותו.
- קבצים שנשמרו רק ב-IndexedDB (גיבוי אוטומטי כשה-bucket חסר) **לא** מסתנכרנים לבד — העלו שוב את ה-PDF אחרי שה-bucket קיים.

## דמו מול פרודקשן

| סביבה | Supabase | איפה נשמר PDF |
|--------|----------|----------------|
| **פרודקשן** | חובה | `training-docs` (אחרי יצירת bucket) |
| **דמו** (`VITE_DEMO_MODE=true`) | בדרך כלל **לא** | IndexedDB + `localStorage` למטא-דאטה |
| **דמו עם Supabase** (נדיר) | כן | אותו bucket `training-docs` |

לוח זמנים ומפגשים בדמו: `localStorage` (`trainingScheduleStore`). מצגות בדמו ללא Supabase: **IndexedDB בלבד** — רק בדפדפן שבו הועלה הקובץ.

## משתני סביבה (Vercel פרודקשן)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# אל תגדירו VITE_DEMO_MODE=true בפרודקשן
```

אחרי שינוי — **Redeploy** ב-Vercel.
