# דמו מול פרודקשן — מניעת דליפת תכונות דמו ללייב

מסמך זה מגדיר איך לעבוד כך שמה שמפתחים/מציגים בדמו **לא** יגיע אוטומטית לסביבת הפרודקשן האמיתית.

## למה שני פרויקטי Vercel לא מספיקים לבד?

יצירת **פרויקט דמו** ו**פרויקט פרודקשן** היא הצעד הנכון — אבל **לא** מבטיחה הפרדה אם מתקיים אחד מהבאים:

| סיבה | מה קורה | מה לעשות |
|------|---------|----------|
| **(A) משתנה סביבה שגוי בפרויקט הפרודקשן** | `VITE_DEMO_MODE=true` ב-**Production** (או מסומן **All Environments**) → ה-build של הפרודקשן יוצא כדמו | ב-Vercel → פרויקט **smart-break-shift** → Environment Variables → **Production**: מחק את `VITE_DEMO_MODE` או ודא שאינו `true` → **Redeploy** |
| **(B) קוד שלא היה מסונן (תוקן לאחרונה)** | אותו קוד ב-GitHub הציג CRM / בסיס ידע / לוגו גם בלי דמו — רק ה-**נתונים** הושפעו חלקית מ-`VITE_DEMO_MODE` | אחרי deploy של הקוד המעודכן: בפרודקשן רק 2 כרטיסים, `DemoGate` על נתיבי דמו, ללא לוגו דמו (ראו אימות למטה) |
| **(C) נכנסת ל-URL הלא נכון** | שני פרויקטים = שני כתובות `*.vercel.app` שונות | בדשבורד Vercel: **Domains** לכל פרויקט — סמן איזה URL הוא דמו ואיזה לייב |
| **(D) אותו דומיין מותאם על שני הפרויקטים** | הדפדפן יפתח את מה ש-Vercel מקשר לדומיין — עלול להיות הדמו | דומיין מותאם **רק** על פרויקט הפרודקשן; לדמו השאר `something-demo.vercel.app` |
| **(E) push ל-GitHub מפעיל build בשניהם** | `upload-to-github.ps1` דוחף ל-`main` → **שני** הפרויקטים בונים מחדש — אבל כל אחד עם **ה-env שלו** | זה תקין; הבעיה היא רק אם (A) או deploy ישן לפני (B) |

**חשוב:** `upload-to-github.ps1` **לא** שולח `.env` ל-GitHub. הוא לא יכול "להדליק דמו" בפרודקשן — רק הגדרות Vercel של **אותו פרויקט** בזמן build.

---

## עקרון מרכזי

`VITE_DEMO_MODE` נקבע **בזמן build** (Vite + Vercel). אותו קוד ב-GitHub יכול להפוך לדמו או ללייב — **רק** לפי משתני הסביבה בפרויקט Vercel שבונה את ה-deploy.

```text
קוד ב-GitHub  →  Vercel build  →  VITE_DEMO_MODE בזמן build  →  האתר שיוצא
```

לכן: העלאה ל-GitHub (`upload-to-github.ps1`) **אינה** בוחרת דמו/לייב. בוחרים ב-**Vercel → Environment Variables** לכל פרויקט.

---

## ארכיטקטורה מומלצת: שני פרויקטי Vercel

| פרויקט Vercel | שימוש | `VITE_DEMO_MODE` | Supabase |
|---------------|--------|------------------|----------|
| **smart-break-shift-demo** | הדגמות ללקוח, ניסויים UI | `true` (Production) | לא חובה |
| **smart-break-shift** (פרודקשן) | נציגים אמיתיים | **אסור** — אל תגדיר, או `false` | חובה: URL + anon key |

**למה שני פרויקטים ולא אחד עם Preview=דמו?**

- Preview deployments נבנים לפעמים מ-PR/ענפים — קל לבלבל Preview עם Production.
- שני פרויקטים = שני URLs קבועים, שני סטים משתנים, פחות טעויות "לחצתי Deploy על הפרויקט הלא נכון".

### חלופה (פחות מומלץ): פרויקט Vercel אחד

- **Production** = לייב (בלי `VITE_DEMO_MODE`)
- **Preview** = דמו (`VITE_DEMO_MODE=true` רק ב-Preview)

דורש משמעת: לעולם לא להגדיר `VITE_DEMO_MODE=true` תחת **Production** באותו פרויקט.

---

## כלל זהב

> **לעולם אל תגדיר `VITE_DEMO_MODE=true` בסביבת Production של האתר האמיתי.**

אם המשתנה חסר או שווה לכל דבר שאינו המחרוזת `"true"` — האפליקציה רצה במצב לייב (`demoModeEnabled === false`).

---

## פיתוח מקומי

| סקריפט | מצב | מה קורה |
|--------|-----|---------|
| `preview-shell.ps1` | **דמו** | מגדיר/מעדכן `.env.local` עם `VITE_DEMO_MODE=true`, PIN דמו, `npm run dev` |
| `preview-live.ps1` | **סימולציית פרודקשן** | דורש Supabase ב-`.env.local`, מעקף דמו לסשן (`VITE_DEMO_MODE=false`) |

**לפני שינוי שמשפיע על לייב:** הרץ `preview-live.ps1` ובדוק שהמסכים נראים כמו פרודקשן (ראו "אימות אחרי deploy" למטה).

---

## הגדרות Vercel מומלצות (מניעת פריסת דמו לייב)

**מטרה:** push ל-GitHub לא יפרוס אוטומטית לייב אלא אם **בחרת** במפורש.

| פרויקט | המלצה | למה |
|--------|--------|-----|
| **smart-break-shift-demo** | Auto-deploy מ-`main` **או** מענף `demo` — בסדר | רק אתר ההדגמה; `VITE_DEMO_MODE=true` |
| **smart-break-shift** (פרודקשן) | **לא** auto-deploy מכל push — ראו למטה | מונע "דמו בקוד" + rebuild לייב בלי כוונה |

### אפשרות א' (הכי בטוחה): פריסת פרודקשן ידנית בלבד

1. Vercel → פרויקט **פרודקשן** → **Settings → Git**
2. כבה **Automatic Deployments** ל-Production (או נתק זמנית את ה-repo אם צריך).
3. כשמוכן לייב: **Deployments → Deploy** (או Redeploy ל-commit ספציפי) **ידנית**.

### אפשרות ב': Production רק מתג `prod-release`

1. Vercel → פרויקט פרודקשן → **Settings → Git → Production Branch** — הגדר ענף/תג לפי מדיניות הצוות.
2. ב-GitHub: צור תג `prod-release` רק כשמאושר לייב (`git tag prod-release && git push origin prod-release`).
3. חבר ב-Vercel deploy ל-production רק מתגים/ענף ייעודי (לא מכל push ל-`main`).

### אפשרות ג': Ignored Build Step (פרודקשן לא נבנה מ-main)

בפרויקט **פרודקשן** → **Settings → Git → Ignored Build Step**, לדוגמה:

```bash
# exit 0 = דלג על build | exit 1 = בצע build
# פרויקט פרודקשן: בנה רק מענף/תג prod-release (התאימו שם)
if [ "$VERCEL_GIT_COMMIT_REF" = "prod-release" ]; then exit 1; fi
exit 0
```

הדמו נשאר עם auto-deploy על `main` או `demo`. פרויקט הפרודקשן לא ייבנה מ-push ל-`main`.

### ענף `demo` (ניסויים בלי לגעת ב-main)

1. ב-Vercel → פרויקט **דמו** → Git → Production Branch = `demo` (או Preview מ-`demo`).
2. מקומי: `.\upload-demo-only.ps1` — דוחף לענף `demo` בלבד; `main` לא משתנה → פרודקשן שמאזין רק ל-`main` לא יקבל את הקוד.

---

## העלאה ל-GitHub

| סקריפט | ענף | שימוש |
|--------|-----|--------|
| `upload-to-github.ps1` | `main` (ברירת מחדל) | תפריט: [1] העלאת קוד, [2] ביטול. פרמטרים: `-Target Demo` / `-Target Production` / `-Branch` |
| `upload-demo-only.ps1` | `demo` | ניסויי דמו בלי לעדכן `main` |

- **לא** מעלה `.env*`, `.cursor/`, `.agents/` — הגדרות Vercel נשארות ב-Vercel; פחות רעש ב-repo.
- אחרי push ל-`main`, **כל** פרויקט Vercel שמחובר ל-repo ומאזין ל-`main` עלול לבנות — ההתנהגות תלויה ב-env **של אותו פרויקט** ובהגדרות auto-deploy למעלה.

### דוגמאות

```powershell
# תפריט אינטראקטיבי (ברירת מחדל)
.\upload-to-github.ps1

# העלאה עם אישור מפורש לנתיב פרודקשן (main)
.\upload-to-github.ps1 -Target Production

# דמו / עדכון קוד עם אזהרת דמו
.\upload-to-github.ps1 -Target Demo

# ניסויים — רק ענף demo
.\upload-demo-only.ps1
```

לפני העלאה ל-main שמשפיעה על לייב:

1. ודא שפרויקט **הפרודקשן** ב-Vercel **אין** בו `VITE_DEMO_MODE=true` (Production).
2. העדף `upload-demo-only.ps1` לשינויי UI ללקוח; פרוס לייב רק אחרי בדיקות (להלן).

### שגיאת «Branch update failed» / SHA שונה מהצפוי

הסקריפט מעלה קבצים דרך GitHub API (לא `git push`). אם מופיעה הודעה עם **Expected** ו-**got** SHA שונים:

- **סיבה נפוצה:** שני חלונות PowerShell הריצו העלאה במקביל, או push אחר לענף `demo`/`main` בזמן ההעלאה. העלאה האחרונה ניצחה; לפעמים העץ ב-GitHub כבר נכון למרות ה-SHA שונה.
- **מה לעשות היום:**
  1. בדוק ב-[commits לענף](https://github.com/asaf2310-boop/smart-break-shift/commits/demo) שהקומיט האחרון נראה כמו ההעלאה שלך (`Upload [Demo] to demo`).
  2. אם כן — אין צורך בהעלאה חוזרת; בדוק deploy ב-Vercel לפרויקט הדמו.
  3. אם לא — המתן 30 שניות והרץ **פעם אחת**: `.\upload-demo-only.ps1` (או `upload-to-github.ps1` עם הפרמטרים שלך). אל תריץ שני סקריפטים במקביל.
- מקומי (אם יש git): `git fetch origin` ואז `git rev-parse HEAD` מול `git rev-parse origin/demo` — העלאה דרך הסקריפט **לא** מעדכנת את ה-clone המקומי; רק את GitHub.

---


## צ'קליסט: «אני מפריס לייב»

עשה את זה **רק** כשהחלטת במפורש לפרוס לנציגים אמיתיים:

- [ ] בדקתי ב-`preview-live.ps1` — מסכים כמו פרודקשן (2 כרטיסים, בלי CRM/דמו).
- [ ] הרצתי `.\scripts\verify-prod-build.ps1` — עבר.
- [ ] Vercel פרודקשן: **אין** `VITE_DEMO_MODE=true` ב-Production.
- [ ] יש `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` ב-Production.
- [ ] אם השתמשת ב-`upload-to-github.ps1 -Target Production` או דחפת ל-`main`: פרויקט הפרודקשן **מוגדר** לפריסה ידנית / מתג — לא auto מכל push.
- [ ] ב-Vercel → פרויקט פרודקשן → **Deploy** (ידני) או תג `prod-release` — **אחרי** שהקוד ב-GitHub נכון.
- [ ] אימות ידני ב-URL הלייב (ראו «אימות אחרי deploy לפרודקשן»).

**לא** מפריסים לייב אחרי `upload-demo-only.ps1` בלבד — אלא אם גם מיזגת ל-`main` וביצעת deploy מכוון.

---

## כללי קוד לכל תכונה חדשה

1. **תמיד** השתמש ב-`demoModeEnabled` מ-`src/api/demoClient.js` — לא ב-`import.meta.env.VITE_DEMO_MODE` ישירות (חוץ ממקום ההגדרה ב-`demoClient.js`).
2. UI/נתונים שדמו בלבד: עטוף ב-`if (demoModeEnabled)` או מערך כרטיסים/נתיבים מותנה (ראו `Home.jsx` — `productionCards` מול `demoOnlyCards`).
3. נתונים: דמו → `localStorage` / `demoClient`; לייב → Supabase (`src/api/client.js`).
4. לפני merge ל-main: בדיקה ב-`preview-live.ps1`.

דוגמאות קיימות: `AgentLogin.jsx` (דמו ולייב = אימייל/סיסמה; לייב + `brandHero`), `brandShell.js` (`app-brand-background` תמיד; `app-hyp-demo` רק בדמו), `Home.jsx` (`HypHomeShell` + `showDemoBadge` רק בדמו), `scheduling.js` (שמות נציגים).

---

## צ'קליסט לפני העלאה / פריסה לפרודקשן

- [ ] בדקתי ב-`preview-live.ps1` — לא רואים CRM, בסיס ידע, השתלטות מרחוק, באנר "דמו פעיל".
- [ ] ב-Vercel → פרויקט **פרודקשן** → Settings → Environment Variables → **Production**: אין `VITE_DEMO_MODE=true`.
- [ ] יש `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` ב-Production.
- [ ] (טלפוניה) אם Softphone חי — VITE_SIP_WS_URL + משתני שרת SIP; ראו [SELF_HOSTED_PBX.md](./SELF_HOSTED_PBX.md).
- [ ] (אופציונלי) הרצתי `scripts/verify-prod-build.ps1` — עבר בלי מחרוזות דמו ב-`dist/`.
- [ ] אחרי deploy — אימות ידני באתר הלייב (להלן).

---

## אימות אחרי deploy לפרודקשן

פתח את URL הפרודקשן (לא את דמו), במצב פרטי / אחרי **Hard refresh** (Ctrl+Shift+R):

1. **מסך כניסה:** רקע סגול/מיתוג AllInCenter, תמונת hero (`/brand/allincenter-login-hero-dark.png`), כרטיס זכוכית — **אימייל וסיסמה** (לא סיסמת דמו קבועה). **לא** מסך לבן ישן `login-shell--prod` בלבד. **אין** טאב "שם נציג".
2. **דף הבית אחרי כניסה:** מעטפת `HypHomeShell` (פאנל ויזואלי + כרטיסי זכוכית) — **2–3 כרטיסים** לפי מודולים (הפסקות, משמרות, הדרכה; בלי CRM / בסיס ידע / השתלטות).
3. **לוגו בפינה:** מופיע בנתיבים עם ניווט עליון (`/breaks`, `/shifts`, `/training`) — `BrandHeader`.
4. **אין** תג "סביבת דמו · נתונים פיקטיביים בלבד" / "דמו פעיל".
5. ניווט: `hyp-nav-bar` (מיתוג), בלי CRM / remote-support / knowledge.
6. **ב-devtools → Elements:** על `<html>` יש `app-brand-background` ו**אין** `app-hyp-demo` (זה רק כש-`VITE_DEMO_MODE=true` ב-build).

אם אחד מהסעיפים נכשל — **עצור**: בדוק משתני Vercel של פרויקט הפרודקשן ועשה Redeploy אחרי תיקון (משתני `VITE_*` נכנסים רק ב-build חדש).

---

## אימות אחרי deploy לדמו (אופציונלי)

בפרויקט **smart-break-shift-demo**:

- `VITE_DEMO_MODE=true` ב-Production.
- כניסה באימייל/סיסמת דמו, יותר מ-2 כרטיסים, לוגו, "דמו פעיל" במקומות רלוונטיים.
- **לוגו כניסה (שחזור):** צילום מיתוג [`BRAND_SNAPSHOT_LOGIN_HERO.md`](BRAND_SNAPSHOT_LOGIN_HERO.md) — מזהה `login-hero-full-v1`.

---

## סקריפטי עזר

| קובץ | תפקיד |
|------|--------|
| `upload-to-github.ps1` | העלאת קוד ל-GitHub (`main` או `-Branch`) + תפריט / `-Target` |
| `upload-demo-only.ps1` | העלאה לענף `demo` בלבד — לא משנה `main` |
| `scripts/verify-prod-build.ps1` | build מקומי **בלי** דמו + חיפוש מחרוזות דמו ב-`dist/` |
| `preview-shell.ps1` | פיתוח דמו |
| `preview-live.ps1` | פיתוח כמו לייב |

---

## סיכום במשפט

**קוד אחד ב-GitHub, שני אתרים ב-Vercel — ההפרדה היא במשתני הסביבה בזמן build, לא בקובץ נפרד ב-repo.**

