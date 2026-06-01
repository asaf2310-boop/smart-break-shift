# צילום מיתוג: login-hero-full-v1

**תאריך:** 2026-05-23  
**מצב:** לוגו כניסת דמו — PNG אופקי מלא (`variant="full"`, `size="hero"`) על רקע כהה, אחרי חזרה מ-lockup / cap-A.

## איך לבקש שחזור

אפשר לומר לסוכן:

- **עברית:** «הכנס את הלוגו השמור login-hero-full» / «שחזר את צילום המיתוג login-hero-full-v1»
- **אנגלית:** «Restore brand snapshot login-hero-full-v1»

מזהה מלא: **`login-hero-full-v1`**

---

## נכסים (Assets)

| תפקיד | נתיב |
|--------|------|
| עותק צילום (גיבוי) | `public/brand-snapshots/login-hero-full-v1.png` |
| **SVG ל-Figma / handoff** | `public/brand/login-hero-full-v1.svg` — רסטר מוטמע (PNG ב-base64), `viewBox="0 0 1536 1024"` |
| עותק SVG (גיבוי) | `public/brand-snapshots/login-hero-full-v1.svg` |
| קובץ ריצה נוכחי (כניסה כהה / דמו) | `public/allincenter-logo-hero-ac.png` — capital A+C, רקע שקוף (`BRAND_LOGO_HERO_AC_SRC`) |
| לוגacy / snapshot (גיבוי / סקריפטים) | `public/allincenter-logo.png` — `login-hero-full-v1` snapshot |
| לוגו בהיר (דף ראשי / m3-page) | `public/allincenter-logo-bright.png` — ראה `docs/BRAND_LOGO_BRIGHT.md` |
| קבוע בקוד | `BRAND_LOGO_HERO_AC_SRC`, `BRAND_LOGO_SNAPSHOT_SRC`, `BRAND_LOGO_BRIGHT_SRC` ב־`BrandLogo.jsx` |

לשחזור PNG: העתק את הצילום ל־`public/allincenter-logo.png`; הרץ `node scripts/create-logo-ac-cap-transparent.mjs` לייצור hero-ac.

### SVG (Figma)

- **נתיב:** `public/brand/login-hero-full-v1.svg`
- **סוג:** מעטפת SVG עם **רסטר מוטמע** (לא וקטור אמיתי) — התאמה ויזואלית 1:1 ל-PNG.
- **ייבוא ל-Figma:** File → Import → בחר את ה-SVG; או גרירה לקנבס. הגודל נשמר ביחס 1536×1024; אפשר לשנות גודל מסגרת בלי לעוות יחס גובה-רוחב.
- **ריענון מה-PNG:** `node scripts/png-to-brand-svg.mjs` (מקור: `public/brand-snapshots/login-hero-full-v1.png`; מעתיק עותק ל־`public/brand-snapshots/`).

---

## מה **לא** להשתמש (במסך כניסת דמו)

| אל תשתמש | למה |
|----------|-----|
| `variant="lockup"` או `"icon"` או `"auto"` | lockup = אייקון חתוך + wordmark נפרד; auto על `md`/`lg` בוחר lockup |
| `accentLetters="first"` (cap-A) ב־`BrandWordmark` | סגנון lockup ישן — רק A מוגדל |
| wordmark מעל PNG מלא | ה-PNG כבר כולל hub + שם; lockup יוצר כפילות |
| `size` שאינו `hero` בכניסה | xl/sm מתאימים למקומות אחרים, לא לגיבור login |
| overlay / שכבות נוספות על התמונה | הגדרה הנוכחית = `<img>` ישיר בלבד, ללא wrapper overlay |

---

## הגדרות קוד לשחזור (מדויק)

### `AgentLogin.jsx` — `LoginShell` (רק כש־`demoModeEnabled`)

```jsx
<BrandEntryBlock
  onDark
  variant="full"
  size="hero"
  className="relative z-10 w-full px-4 flex flex-col items-center justify-center mx-auto text-center mb-6 sm:mb-8 shrink-0 max-w-[min(90vw,960px)]"
/>
```

### `BrandEntryBlock.jsx` (ברירות מחדל רלוונטיות)

| Prop | ערך לצילום |
|------|------------|
| `variant` | `"full"` (ברירת מחדל) |
| `onDark` | `true` בכניסה |
| `brightLogo` | לא נדרש — `allincenter-logo-hero-ac.png` שקוף (ללא multiply) |
| `size` | `"hero"` (כש־`onDark`, ברירת מחדל לוגו = hero) |
| `subtitle` | `"מערכת מוקד"` (מוצג מתחת ללוגו) |

`BrandLogo` בתוך הבלוק:

- `variant={variant}` → `"full"`
- `onDark={onDark}` → `true`
- `onDark={onDark}` → `true`
- `linkToHome={false}`
- `size={logoSize}` → `"hero"`
- `className`: `mx-auto w-full justify-center` + `max-w-[min(90vw,960px)]` (עם onDark)
- `imgClassName`: `undefined` (drop-shadow מוגדר ב־`BrandLogo` כש־`onDark` + hero-ac)

### `BrandLogo.jsx` — התנהגות `full` + `hero` + `onDark`

- מקור: `BRAND_LOGO_HERO_AC_SRC` (`/allincenter-logo-hero-ac.png`) כש־`onDark`
- גרפיקה: `<img>` אופקי מלא (לא lockup, לא icon)
- `SIZE_IMG_CLASS.hero`:  
  `h-auto w-full max-w-[min(90vw,960px)] sm:max-w-[720px] md:max-w-[840px] lg:max-w-[960px] object-contain`
- `onDark` על `full`: **ללא** `mix-blend-multiply`; `drop-shadow` + `brightness-110` על PNG שקוף
- `onDark` + `brightLogo`: `BRAND_LOGO_BRIGHT_SRC` + drop-shadow (אופציונלי)
- `WIDTH_ONLY_SIZES`: `hero` — ללא `height`/`maxHeight` קשיחים; רוחב מוביל

### רקע כניסה (`LoginShell`)

`bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900` — לוגו מוצג רק בדמו (`demoModeEnabled`); בפרודקשן כותרת טקסט «כניסת נציג» ללא `BrandEntryBlock`.

---

## צעדי שחזור לסוכן עתידי

1. קרא מסמך זה ואת שלושת הקבצים: `BrandLogo.jsx`, `BrandEntryBlock.jsx`, `AgentLogin.jsx`.
2. העתק `public/brand-snapshots/login-hero-full-v1.png` → `public/allincenter-logo.png` אם הקובץ הראשי השתנה.
3. ב־`AgentLogin.jsx` — ודא ש־`BrandEntryBlock` תואם לטבלה למעלה (`onDark`, `variant="full"`, `size="hero"`, `className` עם `max-w-[min(90vw,960px)]`).
4. לייצור hero-ac: `node scripts/create-logo-ac-cap-transparent.mjs` (מקור: `allincenter-logo.png`).
5. אל תחליף ל־`lockup` / `auto` / `icon`; אל תוסיף `BrandWordmark` נפרד מעל PNG מלא.
6. הרץ דמו מקומי (`VITE_DEMO_MODE=true`), פתח מסך כניסה, אמת לוגו גיבור מלא ללא כפילות טקסט.
7. **אל** לשנות התנהגות ריצה בפרודקשן — רק דמו מציג את הבלוק (כמו היום).

---

## English — technical reference

**Snapshot ID:** `login-hero-full-v1`  
**User phrase:** “Restore saved logo login-hero-full” / Hebrew above.

**Asset paths**

- Snapshot copy: `public/brand-snapshots/login-hero-full-v1.png`
- **SVG (Figma handoff):** `public/brand/login-hero-full-v1.svg` — embedded PNG raster, `viewBox="0 0 1536 1024"`; regenerate with `node scripts/png-to-brand-svg.mjs`
- Snapshot SVG copy: `public/brand-snapshots/login-hero-full-v1.svg`
- Runtime asset (login demo): `public/allincenter-logo-hero-ac.png` via `BRAND_LOGO_HERO_AC_SRC` (`onDark`)
- Legacy snapshot PNG: `public/allincenter-logo.png` — script source / restore

**Login demo stack**

| Layer | Settings |
|-------|----------|
| `AgentLogin` `BrandEntryBlock` | `onDark`, `variant="full"`, `size="hero"`, wrapper `max-w-[min(90vw,960px)]`, margins `mb-6 sm:mb-8` |
| `BrandEntryBlock` → `BrandLogo` | `linkToHome={false}`, `onDark` → logo size `hero`, transparent hero-ac PNG, container `max-w-[min(90vw,960px)]` |
| `BrandLogo` `full` + `hero` | Full horizontal PNG; hero width classes; `onDark` uses hero-ac + drop-shadow (no multiply) |
| Gated by | `demoModeEnabled` only in `LoginShell` |

**Do not use for this screen:** `lockup`, `icon`, `auto` variants; `accentLetters="first"` (cap-A lockup); separate wordmark over full PNG; non-hero sizes; extra image overlays.

**Restore:** Copy snapshot PNG to `allincenter-logo.png` if needed; align `AgentLogin` / `BrandEntryBlock` props as in tables; verify under `VITE_DEMO_MODE=true`. No production login logo change unless explicitly requested.
