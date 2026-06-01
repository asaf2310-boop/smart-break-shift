# צ'קליסט פריסה — מיתוג AllInCenter בפרודקשן (בלי `VITE_DEMO_MODE`)

## לפני push

```powershell
cd c:\Users\asafar\Downloads\s\smart-break-shift
Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue
.\scripts\verify-prod-build.ps1
```

או:

```powershell
Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue
npm run build
# JS: allincenter-login-hero, app-brand-background, login-shell--brand
# CSS: app-brand-background, login-shell--brand
```

## העלאה ל-GitHub

```powershell
.\upload-to-github.ps1 -Target Production
```

- הסקריפט **לא** מעלה `.env*` — `VITE_*` נשארים ב-Vercel בלבד.
- push ל-`main` עלול להפעיל build ב**כל** פרויקט Vercel שמחובר ל-repo.

## Vercel — פרויקט פרודקשן (לייב)

| בדיקה | ערך נכון |
|--------|-----------|
| שם פרויקט | **smart-break-shift** (לא `*-demo`) |
| Production URL | למשל `https://hypsmart.vercel.app` — ודא ב-**Settings → Domains** |
| `VITE_DEMO_MODE` | **לא מוגדר** ב-Production, או `false` — **לא** `true`, **לא** All Environments |
| Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ב-Production |
| אחרי שינוי env | **Deployments → … → Redeploy** (משתני `VITE_*` רק ב-build חדש) |

## אחרי deploy

1. פתח URL הפרודקשן במצב פרטי / Ctrl+Shift+R.
2. כניסה: hero AllInCenter + בחירת שם.
3. `<html class="app-brand-background">` בלי `app-hyp-demo`.
4. ראה [`DEMO_VS_PRODUCTION.md`](DEMO_VS_PRODUCTION.md) — «אימות אחרי deploy לפרודקשן».

## אם עדיין רואים עיצוב ישן

| סיבה | פתרון |
|------|--------|
| Deploy ישן / לא נבנה מ-`main` האחרון | Redeploy commit האחרון בפרויקט **הנכון** |
| `VITE_DEMO_MODE=true` בפרודקשן | מחק → Redeploy |
| נכנסת ל-URL של **דמו** | השווה Domains בשני הפרויקטים |
| מטמון דפדפן / CDN | Hard refresh; ב-Vercel אפשר «Clear cache and redeploy» |
| בדיקה מקומית על `dist/` ישן | מחק `dist/`, הרץ `verify-prod-build.ps1` מחדש |

## פרויקט דמו (נפרד)

- `VITE_DEMO_MODE=true` ב-Production של **smart-break-shift-demo** בלבד.
- כניסה באימייל, יותר כרטיסים, `app-hyp-demo` על `<html>`.
