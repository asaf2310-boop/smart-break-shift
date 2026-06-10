# GitHub Desktop — smart-break-shift

מדריך קצר לעבודה יומיומית במקום `upload-to-github.ps1`.

## הוספה ל-GitHub Desktop (לא Clone)

1. **GitHub Desktop** → **File** → **Add local repository…**
2. בחר: `C:\Users\asafar\Downloads\s\smart-break-shift`
3. אם מופיע "not a Git repository" — ודא שהתיקייה הנכונה (יש `.git` ו-remote `origin`).

**Clone** — רק אם רוצים עותק **חדש** במקום אחר. העבודה שלך כבר כאן עם `origin` מוגדר.

## Remote (כבר מוגדר)

- `https://github.com/asaf2310-boop/smart-break-shift.git`

## ענפים

| ענף | שימוש |
|-----|--------|
| `demo` | ניסויים / דמו — עדיף לרוב העבודה היומית |
| `main` | פרודקשן — דחיפה מפעילה deploy ב-Vercel (אם מחובר) |

ב-GitHub Desktop: **Current branch** → בחר `demo` או `main`.

## זרימה יומית

1. **Changes** — סמן קבצים (או הכל)
2. **Summary** + **Commit to demo** (או main)
3. **Push origin** (או **Publish branch** אם ענף חדש)

## Vercel

כל **push** ל-GitHub עלול להפעיל build בכל פרויקט Vercel שמחובר ל-repo.  
Demo vs Production נקבע ב-**env של כל פרויקט Vercel**, לא לפי הכלי שדוחפים.  
פרטים: `docs/DEMO_VS_PRODUCTION.md`

## סקריפט PowerShell vs Push רגיל

| | `upload-to-github.ps1` | GitHub Desktop (git push) |
|--|------------------------|---------------------------|
| אימות | Token + אזהרות Vercel; Production דורש הקלדת `PROD` | אין שער PROD — אתה בוחר ענף |
| תוכן | **מחליף** את כל העץ בענף (API, force ref) | דוחף **commits** — היסטוריה רגילה |
| קבצים | מדלג על `.env`, `node_modules`, `.cursor` וכו' | מה שב-gitignore / staged |

לפרודקשן: לפני push ל-`main` — `scripts/verify-prod-build.ps1` ובדיקת env ב-Vercel.

## עדיין להשתמש בסקריפט?

כן אם אין git מותקן / אין הרשאות push — הסקריפט עובד דרך API.  
לאחר GitHub Desktop — בדרך כלל **לא צריך** את הסקריפט לעבודה שוטפת.
