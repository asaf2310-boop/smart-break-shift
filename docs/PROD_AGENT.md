# סוכן פרודקשן — smart-break-shift

**התיקייה הזו = סביבת אמת.** עבוד כאן על פרודקשן, Supabase, ושיבוץ/הפסקות לנציגים אמיתיים.

לעבודת **דמו** (UI, CRM, לוגו, מיתוג כניסה) — פתח **Agent חדש** והדבק את `docs/DEMO_AGENT_PROMPT.md` בהודעה הראשונה.

---

## מה כן / מה לא

| | כאן (פרודקשן) | Agent דמו נפרד |
|--|----------------|-----------------|
| **Vercel** | `smart-break-shift` | `smart-break-shift-demo` |
| **`VITE_DEMO_MODE`** | **אסור** `true` ב-Production | `true` |
| **ענף GitHub** | `main` | `demo` |
| **העלאה** | `upload-to-github.ps1 -Target Production` | `upload-demo-only.ps1` |
| **נושאים** | שיבוץ, הפסקות, Supabase, באגים | CRM, לוגו, UI ללקוח, מייל |

---

## הרצה מקומית (כמו פרודקשן)

```powershell
# .env.local לפי .env.live.example — Supabase URL + anon key
.\preview-live.ps1
```

לא משתמשים ב-`preview-shell.ps1` לבדיקת פרודקשן (זה דמו).

### בדיקת `/admin` בלי PIN (כמו פרודקשן)

| סקריפט | מצב | `/admin` |
|--------|-----|----------|
| **`preview-live.ps1`** | לייב (Supabase), בלי `VITE_DEMO_MODE`, בלי `VITE_ADMIN_PIN` | **פתוח ישירות** — אין מסך "כניסת מנהל" |
| `preview-shell.ps1` | דמו (`VITE_DEMO_MODE=true`, `VITE_ADMIN_PIN=1234`) | מסך PIN — קוד **1234** |

- `isProductionAdminOpen()` (`useIsAdmin.js`) — `/admin` ללא שער בכל build שבו **אין** `VITE_DEMO_MODE=true` (גם אם `VITE_ADMIN_PIN` מוגדר).
- אם ראית מסך PIN או כותרת "מערכת דמו" — כנראה רצת `preview-shell.ps1` או `.env.local` עדיין עם דגלים של דמו.
- **`preview-live.ps1`** מסיר מ-`.env.local` את `VITE_DEMO_MODE` ו-`VITE_ADMIN_PIN` (שנוספו ע"י `preview-shell.ps1`). **עצור את השרת (Ctrl+C) והרץ שוב** `preview-live.ps1` כדי ש-Vite יטען env מחדש.
- לחזרה לדמו מקומי: `preview-shell.ps1` (מחזיר PIN 1234).

---

## העלאה ל-GitHub

```powershell
.\upload-to-github.ps1 -Target Production
```

- דורש הקלדת `PROD` לאישור
- דוחף ל-`main` (ברירת מחדל)
- **לא** מעלה `.env*` — משתני Vercel נשארים ב-Vercel

**לא** מפריסים לייב אחרי `upload-demo-only.ps1` בלבד.

---

## Vercel — פרויקט פרודקשן

- פרויקט: **smart-break-shift**
- Production: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- **אין** `VITE_DEMO_MODE=true` ב-Production
- אחרי שינוי env — **Redeploy** (build חדש)
- מומלץ: deploy ידני / לא auto-deploy מכל push (ראו `docs/DEMO_VS_PRODUCTION.md`)

---

## צ'קליסט לפני deploy לייב

1. **בדיקה מקומית (חובה לפני העלאה):**
   ```powershell
   # עצור dev server קודם (Ctrl+C) אם רץ
   .\preview-live.ps1
   ```
   - הסקריפט מסיר מ-`.env.local` את `VITE_DEMO_MODE` ו-`VITE_ADMIN_PIN`
   - **הפעל מחדש** — Vite קורא env רק בהפעלה; `npm run dev` ישיר אחרי `preview-shell` = עדיין דמו + PIN
   - כותרת לשונית: **מערכת ניהול מוקד** (ללא "דמו")
   - `/admin` — כניסה ישירה ללא PIN (באנר צהוב זמני)

2. **Build ו-Vercel:**
   - [ ] `.\preview-live.ps1` — 2 כרטיסים בלבד (הפסקות + משמרות), בלי CRM/ידע/דמו
   - [ ] `.\scripts\verify-prod-build.ps1` — עבר
- [ ] Vercel פרודקשן: אין `VITE_DEMO_MODE=true`
- [ ] Supabase מוגדר ב-Production
- [ ] Deploy ידני / מכוון — לא בטעות מ-push לדמו

---

## אימות אחרי deploy

1. כניסה: **אימייל וסיסמה** (לא סיסמת דמו קבועה; אין טאב "שם נציג")
2. דף הבית: **2 כרטיסים** בלבד
3. אין לוגו קבוע / באנר "דמו פעיל"
4. ניווט: בלי CRM / remote-support / knowledge

---

## כללי קוד

- `demoModeEnabled` מ-`src/api/demoClient.js` — לא import ישיר של `VITE_DEMO_MODE`
- UI דמו בלבד: עטוף ב-`if (demoModeEnabled)` או רשימות כרטיסים מותנות
- נתונים: Supabase בלייב (`src/api/client.js`)

---

## מסמכים

- `docs/DEMO_VS_PRODUCTION.md` — הפרדה מלאה דמו/לייב
- `.cursor/skills/smart-break-shift-demo/SKILL.md` — סקriptים ו-Supabase
- `supabase/RUN_IN_SUPABASE.sql` — סכימה
