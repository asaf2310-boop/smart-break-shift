# תמיכה מרחוק — smart-break-shift

מסמך זה מתאר **שני מצבי תמיכה מרחוק** בדמו, **רק לאחר אישור מפורש** מהלקוח:

| מצב | שימוש | טכנולוגיה |
|-----|--------|-----------|
| **שלב א — צפייה במסך** | הסבר, הדרכה, אבחון ויזואלי | דפדפן + WebRTC ([PeerJS](https://peerjs.com/)) |
| **שליטה מלאה** | שליטה בעכבר ומקלדת | [RustDesk](https://rustdesk.com/) |

> **אזהרת דמו:** סיסמאות RustDesk וסשנים עשויים להישמר ב-`localStorage`. שיתוף מסך משתמש ב-**PeerServer הציבורי** של PeerJS. **לפרודקשן:** PeerServer עצמי (או Supabase Realtime), שרת RustDesk עצמי (hbbs/hbbr), מדיניות אבטחה, ואחסון מוצפן/זמני.

---

## שלב א — צפייה במסך (דפדפן)

### מה זה נותן?

- הלקוח **אינו מתקין** תוכנה — רק פותח קישור במייל.
- הנציג **רואה** את המסך — **אין** שליטה בעכבר או במקלדת.
- מומלץ **Chrome** או **Edge** אצל הלקוח.

### זרימת PeerJS (חשוב)

1. **נציג** יוצר סשן ומשאיר פתוח את מסך הצפייה (`new Peer(sessionId)` — ממתין לשיחה נכנסת).
2. **לקוח** פותח `/support/screen/:sessionId`, מאשר, לוחץ «אני מאשר ומשתף מסך».
3. **לקוח** `getDisplayMedia` → `new Peer()` → `peer.call(sessionId, stream)`.
4. **נציג** מקבל `call`, עונה ב-`answer()`, מציג ב-`<video>`.

אם הנציג לא פתח את מסך הצפייה לפני הלקוח — החיבור עלול להיכשל (מזהה לא זמין / timeout).

### מה הלקוח עושה

1. לפתוח את הקישור מהמייל: `{origin}/support/screen/{sessionId}?b=…` (בדמו — פרמטר `b` מכיל מטא-דאטה מינימלי ליצירת הסשן בדפדפן האורח)
2. לקרוא את ההסבר, לסמן אישור.
3. ללחוץ «אני מאשר ומשתף מסך».
4. לבחור מסך / חלון / לשונית בשיתוף הדפדפן.

### מה הנציג עושה

1. «תמיכה מרחוק» → לשונית **שלב א — צפייה (דפדפן)**.
2. הזנת מייל → **התחל סשן צפייה** (חייב להישאר פתוח).
3. שליחת מייל (Resend) / העתקת קישור — הלקוח מאשר בדף `/support/screen/:sessionId`.
4. סטטוס «ממתין לאישור הלקוח בקישור» עד `consentAt`; צפייה בווידאו לאחר שיתוף מסך → **סיים סשן**.
5. **הקלטה (דמו בלבד):** הלקוח יכול לסמן «אישור הקלטה» בנפרד; הנציג רואה `recordingConsentAt` ואז «התחל הקלטה» → WebM מקומי (`screen-{sessionId}-{timestamp}.webm`).

### הקלטת מסך (דמו — Phase 1)

- **רק** כש-`VITE_DEMO_MODE=true` (`demoModeEnabled`).
- אישור נפרד מהלקוח: תיבת «אישור הקלטה» ב-`/support/screen/:sessionId` → `recordingConsentAt` ב-`screenShareStore`.
- הנציג: כפתורי **התחל הקלטה** / **עצור הקלטה** / **הורד**; נקודה אדומה + טיימר בזמן REC.
- `MediaRecorder` על ה-`remoteStream` (WebRTC); הקובץ **לא** עולה לשרת — הורדה מקומית בדפדפן הנציג.
- ההקלטה נעצרת אוטומטית בסגירת שיחה / סיום סשן / unmount.

### הקלטת מסך (דמו — Phase 2)

| יכולת | פירוט |
|--------|--------|
| **תג לאורח** | כשהנציג מקליט (`recordingActiveAt`) והלקוח אישר הקלטה — תג «המסך מוקלט» בדף האורח; ריענון כל ~1.5 שניות + אירוע `screen-share-changed`. |
| **מטא-דאטה** | בעצירה: `{ sessionId, startedAt, stoppedAt, durationSec, fileName, consentAt }` ב-`localStorage` (סשן + רשימה גלובלית). |
| **ממשק נציג** | «הקלטות בסשן» — משך, זמן, «הורדת הקובץ בוצעה» / «הורד שוב» (כל עוד ה-blob בזיכרון). |
| **CRM (דמו)** | סשן עם `crmCustomerId` → `createCallLog` עם סיכום «הקלטת מסך — X דקות». |
| **מגבלות** | אין התחלת הקלטה ללא זרם וידאו; אזהרה ב-30 דקות (טוסט + באנר, ללא עצירה אוטומטית). |

פונקציות ב-`screenShareStore.js`: `setRecordingActive`, `setRecordingStopped`, `appendSessionRecording`, `listRecordingsForSession`, `markRecordingDownloaded`.

### הקלטת מסך (דמו — Phase 3)

| יכולת | פירוט |
|--------|--------|
| **IndexedDB** | לאחר עצירה: blob + מטא-דאטה ב-`demoRecordingStorage.js` (מפתח `sessionId::recordingId`). «הורד שוב» עובד אחרי רענון דף הנציג. |
| **ספריית הקלטות** | בדף `/remote-support` — «הקלטות שמורות (דמו)»: תאריך, משך, סשן, שם לקוח; פעולות הורד / מחק / העלאה לענן (Phase 5). |
| **סנכרון לאורח** | `recordingActiveAt` ב-`screenShareStore`; דף אורח מרענן כל ~1.5 שניות, **~500ms** בזמן הקלטה פעילה. |
| **תיק לקוח** | מקלטות עם `crmCustomerId` — קישור «שמור לתיק לקוח» ל-`/crm/:id`. |
| **Pre-flight** | לפני «התחל הקלטה» — דיאלוג: חיבור ✓ · אישור הקלטה ✓ · זרם וידאו ✓. |

פונקציות נוספות: `listAllRecordings`, `deleteRecordingMetadata` ב-`screenShareStore.js`; `saveRecordingBlob`, `getRecordingBlob`, `deleteRecordingBlob` ב-`demoRecordingStorage.js`.

### הקלטת מסך (דמו — Phase 4)

| יכולת | פירוט |
|--------|--------|
| **נגן באפליקציה** | «נגן» בספריית ההקלטות — דיאלוג עם `<video controls>` מ-blob ב-IndexedDB; הודעה אם חסר קובץ |
| **ייצוא יומן (דמו)** | «ייצוא יומן הקלטות (דמו)» — JSON: הסכמת צפייה, הסכמת הקלטה, מטא-דאטה, חותמות זמן (ללא וידאו) |
| **אודיו מערכת (אופציונלי)** | בדף האורח: תיבה «כלול אודיו מערכת» (כבוי כברירת מחדל) — רק Chrome/Edge; `getDisplayMedia({ audio: true })`; `MediaRecorder` על הזרם כולל אודיו אם קיים |
| **גודל קובץ** | גודל ב-MB בספרייה (`fileSizeBytes` במטא-דאטה) |
| **העלאה לענן (שלד)** | `recordingUpload.js` — `uploadRecordingToCloud` מחזיר `{ ok: false, message: 'בקרוב — Supabase Storage' }`; כפתור «העלאה לענן» + טוסט (Phase 4) |

**מגבלות אודיו:** Firefox / Safari — לרוב ללא אודיו מערכת ב-`getDisplayMedia`. גם ב-Chrome הלקוח חייב לאשר «שתף אודיו» בחלון השיתוף. אין אודיו מיקרופון — רק אודיו מערכת אם הדפדפן מאפשר.

פונקציות נוספות: `buildDemoRecordingAuditExport`, `updateRecordingMetadata` ב-`screenShareStore.js`; `uploadRecordingToCloud` ב-`recordingUpload.js`.

### הקלטת מסך (דמו — Phase 5)

| יכולת | פירוט |
|--------|--------|
| **ענן מדומה (דמו)** | `uploadRecordingToCloud` — מסמן `demoCloudSaved`, `demoCloudSavedAt`, `demoCloudPath` (`demo/recordings/{id}.webm`) ב-localStorage; ללא Supabase אמיתי |
| **כפתור «העלאה לענן»** | פעיל כשיש blob ב-IndexedDB; טוסט «נשמר בדמו (ענן מדומה)»; תג **בענן (דמו)** בספרייה |
| **תיק לקוח CRM** | בכרטיס `/crm/:id` — מקטע «הקלטות מסך»: נגן, הורד, קישור ל-`/remote-support` |
| **שמירה לפי זמן** | בחירת 7 / 30 / 90 ימים → `localStorage` `demo-recording-retention-days`; בטעינת הספרייה — אזהרה + מחיקת ישנות (מטא + blob) |
| **סיכום אחרי עצירה** | טוסט + פאנל: «הקלטה נשמרה — X דקות, Y MB»; קישורים: הורד / שמור לענן / פתח תיק |
| **סימן לאורח** | בזמן `recordingActiveAt` — טקסט שקוף «מוקלט» בפינה (בנוסף לתג «המסך מוקלט») |
| **פרודקשן (שלד)** | אם `!demoModeEnabled` + Supabase + `VITE_SCREEN_RECORDING_CLOUD_UPLOAD=true` — TODO ל-bucket `screen-recordings` (ללא מפתחות: לא נשבר) |

פונקציות/קבצים נוספים: `listRecordingsForCustomer` ב-`screenShareStore.js`; `demoRecordingRetention.js`; `CustomerScreenRecordings.jsx`.

### הקלטת מסך (דמו בלבד — Phase 6)

> **דמו בלבד — לא פרודקשן.** כל היכולות בשלב זה פעילות רק כש-`VITE_DEMO_MODE=true` (`demoModeEnabled`). אין העלאה אמיתית ל-Supabase Storage; `recordingUpload.js` בפרודקשן מחזיר «זמין רק בדמו» (שלד TODO בלבד).

| יכולת | פירוט |
|--------|--------|
| **הורד הכל** | בספריית ההקלטות — «הורד הכל»: הורדה רציפה של כל הקבצים עם blob ב-IndexedDB (ללא תלות חיצונית חדשה) |
| **הקלטה אוטומטית** | תיבה «התחל הקלטה אוטומטית לאחר חיבור» — `localStorage` `demo-auto-start-recording`; ב-`ScreenShareAgentView` כשיש זרם + `recordingConsentAt` |
| **סטטיסטיקות** | כותרת בספרייה: מספר הקלטות, סה״כ MB, כמה סומנו `demoCloudSaved` |
| **קישור נגן (דמו)** | `/remote-support/recordings/play?id=` — נגן מ-IndexedDB; הערה «עובד באותו דפדפן בלבד»; «קישור» מעתיק URL |
| **ענן מדומה — הסבר** | תג **בענן (דמו)** + tooltip: סימון מקומי בלבד, ללא שרת אמיתי |
| **פרודקשן** | ללא `demoModeEnabled` — אין UI חדש; `uploadRecordingToCloud` → `{ ok: false, message: 'זמין רק בדמו' }` |

פונקציות/קבצים נוספים: `buildRecordingPlayId`, `findRecordingByPlayId` ב-`screenShareStore.js`; `DemoRecordingPlayPage.jsx`.

### Signaling לפרודקשן

בדמו: שרת PeerJS הציבורי (`0.peerjs.com`). לפרודקשן:

- [הרצת PeerServer עצמי](https://github.com/peers/peerjs-server)
- או חלופה: Supabase Realtime / Socket.io לסיגנלינג מותאם

---

## שליטה מלאה — RustDesk

### למה RustDesk?

| יתרון | פירוט |
|--------|--------|
| **חינם וקוד פתוח** | ללא רישיון יקר |
| **שליטה מלאה** | שולחן עבודה אמיתי |
| **אבטחה** | E2E; אירוח עצמי hbbs/hbbr |

האפליקציה **אינה** מחליפה את RustDesk: הנציג פותח **אפליקציית RustDesk** (או `rustdesk://`).

### מה הלקוח עושה

1. להוריד RustDesk: https://rustdesk.com/
2. לשתף מזהה (9 ספרות) וסיסמה.
3. לאשר גישה בדף `/support/consent/:token` (קישור במייל).

### מה הנציג עושה

1. «תמיכה מרחוק» → לשונית **שליטה מלאה — RustDesk**.
2. אשף: מייל הורדה (Resend) + קישור אישור → מזהה וסיסמה → פתיחת RustDesk (אישור לקוח ב-`/support/consent/:token`).

---

## שליחת מייל אמיתית (Resend + Vercel)

ברירת מחדל בדמו (`VITE_DEMO_MODE=true` בלי `VITE_DEMO_SEND_REAL_EMAIL`): מייל **מדומה** — הקישור מוכן להעתקה / mailto.  
כדי לשלוח מייל **אמיתי** גם באתר הדמו, הגדירו את הדגל למטה + מפתחות Resend בשרת.

שיתוף מסך ו-RustDesk משתמשים ב-**Resend** דרך `/api/send-email`; מפתח API **רק בשרת** (לא `VITE_*`).

### פרויקט Vercel: smart-break-shift-demo (Production)

| משתנה | ערך | הערות |
|--------|------|--------|
| `VITE_DEMO_MODE` | `true` | כבר קיים |
| `VITE_DEMO_SEND_REAL_EMAIL` | `true` | **חדש** — build-time; Redeploy אחרי שינוי |
| `VITE_APP_URL` | `https://smart-break-shift-demo.vercel.app` | **מומלץ** — קישורי מייל; חובה אם בונים מ-localhost |
| `RESEND_API_KEY` | `re_...` | מ-[resend.com](https://resend.com) |
| `EMAIL_FROM` | `noreply@your-verified-domain.com` | חייב להיות מדומיין **מאומת** ב-Resend |

לאחר הוספה או שינוי: **Redeploy** (לא רק Save).

### משתני סביבה (Vercel — כל פרויקט עם מייל אמיתי)

| משתנה | דוגמה | הערות |
|--------|--------|--------|
| `RESEND_API_KEY` | `re_...` | מ-[resend.com](https://resend.com) |
| `EMAIL_FROM` | `onboarding@resend.dev` | לבדיקות; בפרודקשן — כתובת מדומיין מאומת |
| `VITE_DEMO_SEND_REAL_EMAIL` | `true` | אופציונלי — רק יחד עם `VITE_DEMO_MODE=true` |

לאחר הוספה: **Redeploy** לפרויקט.

### API

- `GET /api/email-status` — `{ "configured": boolean, "apiPresent": true }` (בודק `RESEND_API_KEY` + `EMAIL_FROM` בלי לחשוף ערכים)
- `POST /api/send-email` — גוף JSON: `{ "to", "subject", "html", "text?" }`
- CORS: same origin בלבד
- אם המפתח לא מוגדר: `503` + `code: email_not_configured` — סימולציה + הודעה; עם `VITE_DEMO_SEND_REAL_EMAIL=true` — **טוסט שגיאה** (ללא סימולציה שקטה)
- אם `/api/*` לא נפרס (404 מ-SPA): בדקו ש-`api/` קיים ב-GitHub ו-Redeploy

### `vercel.json` ונתיבי API

ה-rewrite `{ "source": "/((?!api/).*)", "destination": "/index.html" }` **אינו** מנתב בקשות ל-`/api/*` ל-SPA — רק נתיבים שלא מתחילים ב-`api/` נשלחים ל-`index.html`. אין צורך ב-rewrite נוסף לפונקציות Serverless.

### פתרון בעיות (Vercel)

1. **ודאו שה-API נפרס:** פתחו `https://<your-app>.vercel.app/api/email-status` בדפדפן.
   - תשובה תקינה: `{ "configured": true, "apiPresent": true }` — המייל מוכן.
   - `{ "configured": false, "apiPresent": true }` — ה-API קיים אך חסרים `RESEND_API_KEY` או `EMAIL_FROM` ב-Vercel → Settings → Environment Variables → **Redeploy**.
   - **404 / דף SPA:** תיקיית `api/` חסרה ב-GitHub — הריצו `upload-to-github.ps1` (או `git push`) וודאו:
     - `api/send-email.js`
     - `api/email-status.js`
     ואז Redeploy.
2. **בדיקה מהאפליקציה:** בדף «השתלטות מרחוק» — באנר ירוק «מייל: פעיל» או כתום עם הוראות.
3. **אחרי שינוי env:** תמיד Redeploy (לא רק Save) — משתני סביבה נטענים בזמן build/deploy.

### פיתוח מקומי (דמו + מייל אמיתי)

ב-`.env.local` (או env של `vercel dev`):

```env
VITE_DEMO_MODE=true
VITE_DEMO_SEND_REAL_EMAIL=true
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev
```

| פקודה | שליחה אמיתית |
|--------|----------------|
| `npm run dev` בלבד | **לא** — אין handler ל-`/api/send-email` (רק SPA) |
| `npx vercel dev` | **כן** — Vite מפנה `/api` ל-`127.0.0.1:3000` (ראו `vite.config.js`) |
| פריסה ל-Vercel (דמו + דגל) | **כן** — אחרי Redeploy עם כל המשתנים למעלה |

**חשוב:** אל תשימו `RESEND_API_KEY` ב-`VITE_*`. ראו `.env.example`.

`api/send-email.js` דורש בשרת: `RESEND_API_KEY` + `EMAIL_FROM` (אחרת `503` + `email_not_configured`). עם `VITE_DEMO_SEND_REAL_EMAIL=true` — שגיאה גלויה במקום סימולציה.

### דמו: למי מותר לשלוח (Resend)

| `EMAIL_FROM` | נמען (למשל Gmail / hyp.co.il) | מה קורה |
|--------------|----------------------------------|---------|
| `onboarding@resend.dev` | רק המייל של **חשבון Resend** | שליחה לכתובות אחרות → **403 מ-Resend** → האפליקציה מציגה טוסט שגיאה + `emailLogs` עם `status: failed` |
| כתובת מדומיין **מאומת** (DNS) | כל נמען תקין | Resend מקבל (`200` + `id`) — אם לא מגיע: בדקו **Resend → Emails** (Delivered/Bounced) ותיבת ספאם אצל הנמען |
| לא מוגדר / `npm run dev` בלבד | — | סימולציה או `503` (עם `VITE_DEMO_SEND_REAL_EMAIL=true` — טוסט, בלי «נשלח» שקט) |

**אין** במסלול החינמי של Resend הגבלה «רק Gmail» — ההבדל הוא בדרך כלל `EMAIL_FROM` (בדיקה מול דומיין מאומת) ולא ספק הנמען.

**hyp.co.il:** אם Resend דוחה בשליחה — תראו שגיאה באפליקציה. אם Resend מציג **Delivered** ואין מייל — זה לרוב ספאם/סינון אצל hyp.co.il (לא באג בשרת Vercel).

### קבצים

| קובץ | תפקיד |
|------|--------|
| `api/send-email.js` | Handler ל-Vercel + Resend |
| `api/email-status.js` | בדיקת הגדרת מייל (GET, ללא סודות) |
| `src/lib/emailApi.js` | `fetch` מהדפדפן ל-API |
| `src/lib/screenShareStore.js` | תבנית HTML RTL + `sendScreenShareEmail` |
| `src/lib/remoteSupportStore.js` | מייל RustDesk (אופציונלי) |

---

## אישור משפטי ותיעוד

- **איסור גישה ללא הסכמה מפורשת** — בדף הלקוח (קישור שיתוף מסך או אישור RustDesk), לא דרך תיבת סימון אצל הנציג.
- **הקלטה (דמו):** אישור הקלטה נפרד מאישור צפייה; `recordingConsentAt`, `recordingActiveAt` נשמרים בסשן; מטא-דאטה הקלטות ב-`localStorage`.
- **תיעוד:** זמן, נציג, סוג סשן (צפייה / RustDesk), לקוח CRM.
- צפייה בדפדפן ≠ שליטה מלאה — יש להבהיר ללקוח.

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `src/lib/screenShareStore.js` | סשני צפייה, מייל (Resend), קישור אורח, מטא-דאטה הקלטות |
| `src/lib/demoRecordingStorage.js` | blobs הקלטה ב-IndexedDB (דמו) |
| `src/lib/recordingUpload.js` | העלאה לענן (דמו מדומה + שלד Supabase) |
| `src/lib/demoRecordingRetention.js` | מדיניות שמירה 7/30/90 ימים (דמו) |
| `src/components/remote/DemoRecordingsLibrary.jsx` | רשימת הקלטות שמורות ב-`/remote-support` |
| `src/pages/DemoRecordingPlayPage.jsx` | נגן הקלטה מקומי `/remote-support/recordings/play` (דמו) |
| `src/components/crm/CustomerScreenRecordings.jsx` | הקלטות מסך בכרטיס לקוח CRM |
| `src/lib/remoteSupportStore.js` | סשני RustDesk, אישור, מייל (Resend) |
| `api/send-email.js` | שליחת מייל בשרת |
| `api/email-status.js` | בדיקת סטטוס מייל ב-Vercel |
| `src/components/remote/ScreenSharePanel.jsx` | אשף נציג — שלב א |
| `src/components/remote/ScreenShareAgentView.jsx` | וידאו נציג (PeerJS host) |
| `src/pages/ScreenShareGuestPage.jsx` | דף לקוח `/support/screen/:sessionId` |
| `src/components/remote/RemoteSupportPanel.jsx` | לשוניות: דפדפן + RustDesk |
| `src/pages/RemoteSupportPage.jsx` | סקירה ורשימות סשנים |
| `docs/REMOTE_SUPPORT.md` | מסמך זה |

---

## בדיקה ידנית (דמו)

### צפייה בדפדפן — שני חלונות

1. `npm install` (כולל `peerjs`) → `npm run dev`
2. **חלון א' (נציג):** התחברות → תמיכה מרחוק → שלב א → **התחל סשן צפייה** — השאירו את הדיאלוג/ווידאו פתוח.
3. **חלון ב' (לקוח):** העתיקו קישור אורח → פתיחה ב-Chrome/Edge → «אני מאשר שיתוף מסך» → שיתוף מסך.
4. ודאו שהווידאו מופיע אצל הנציג; סיימו סשן.

### הקלטה (דמו — Phase 1)

1. בחלון הלקוח — סמנו גם «אישור הקלטה» לפני «התחל שיתוף מסך».
2. בחלון הנציג — לאחר חיבור: **התחל הקלטה** → ודאו REC + טיימר → **עצור הקלטה** → **הורד** (קובץ `.webm`).

### הקלטה (דמו — Phase 2)

1. שני חלונות (נציג + לקוח), אותו `origin` — כמו למעלה.
2. לקוח: «אישור הקלטה» + שיתוף מסך — ודאו שאין תג «המסך מוקלט» לפני שהנציג מתחיל.
3. נציג: **התחל הקלטה** — בחלון הלקוח אמור להופיע תג **המסך מוקלט** (אדום).
4. נציג: **עצור** — התג אצל הלקוח נעלם; ב«הקלטות בסשן» מופיעה רשומה; **הורד** → «הורדת הקובץ בוצעה».
5. סשן מקושר ל-CRM: בכרטיס הלקוח — שיחת צ'אט «הקלטת מסך — …».
6. (אופציונלי) להשאיר REC פעילה 30+ דקות בדמו — ודאו טוסט/באנר אזהרה.

### הקלטה (דמו — Phase 3)

1. הקליטו סשן כמו Phase 2 → **עצור** → **הורד** (אופציונלי).
2. רעננו את דף הנציג (או סגרו ופתחו מחדש «תמיכה מרחוק» עם אותו סשן פעיל אם רלוונטי) — ב«הקלטות בסשן» לחצו **הורד שוב** (קובץ מ-IndexedDB).
3. `/remote-support` → «הקלטות שמורות (דמו)» — ודאו רשומה, **הורד**, קישור **שמור לתיק לקוח** (אם סשן מ-CRM), **מחק**.
4. לפני הקלטה — דיאלוג pre-flight עם שלוש סימוני ✓.
5. בזמן REC — בדף האורח התג «המסך מוקלט» מתעדכן מהר יותר (~500ms).

### הקלטה (דמו — Phase 4)

1. הקליטו סשן (Phase 2–3) — ודאו שמופיע גודל קובץ (MB) בספרייה.
2. `/remote-support` → «הקלטות שמורות (דמו)» → **נגן** — וידאו בדיאלוג; סגרו את הדיאלוג.
3. מחקו blob מ-DevTools (או מחקו הקלטה) — **נגן** על רשומה ללא קובץ → הודעת שגיאה ברורה.
4. **ייצוא יומן הקלטות (דמו)** — פתחו את ה-JSON: `screenConsentAt`, `recordingConsentAt`, מטא-דאטה, ללא שדות וידאו/base64.
5. **העלאה לענן** — טוסט «בקרוב — Supabase Storage» (Phase 4; ב-Phase 5 — «נשמר בדמו (ענן מדומה)»).
6. (Chrome) בדף האורח — סמנו «כלול אודיו מערכת», אשרו אודיו בחלון השיתוף, הקליטו — בדקו שההשמעה כוללת אודיו (אם הדפדפן אישר).
7. Firefox — ודאו שתיבת האודיו **לא** מופיעה (או ללא אודיו בזרם).

### הקלטה (דמו — Phase 5)

1. הקליטו סשן (Phase 2–4) — אחרי **עצור**: טוסט «הקלטה נשמרה — … דקות, … MB» + פאנל עם **הורד** / **שמור לענן** / **פתח תיק** (אם סשן מ-CRM).
2. **שמור לענן** או בספרייה **העלאה לענן** — טוסט «נשמר בדמו (ענן מדומה)»; תג **בענן (דמו)** על הרשומה.
3. `/remote-support` → בחרו **שמירה (דמו)** 7 / 30 / 90 ימים — ודאו שנשמר ב-`localStorage` (`demo-recording-retention-days`).
4. (אופציונלי) צרו הקלטה ישנה (או שנהו תאריך במטא-דאטה לבדיקה) — רעננו ספרייה → אישור מחיקה של N הקלטות ישנות.
5. כרטיס לקוח ב-CRM (`/crm/:id`) — מקטע **הקלטות מסך**: **נגן**, **הורד**, קישור **תמיכה מרחוק**.
6. בזמן REC — בדף האורח: תג «המסך מוקלט» + טקסט שקוף **מוקלט** בפינה.
7. פרודקשן ללא `VITE_DEMO_MODE` — אין שינוי התנהגות; שלד Supabase רק עם מפתחות + `VITE_SCREEN_RECORDING_CLOUD_UPLOAD=true`.

### הקלטה (דמו בלבד — Phase 6)

1. ודאו `VITE_DEMO_MODE=true` — בפרודקשן ללא דגל: אין ספריית הקלטות / נגן / «הורד הכל».
2. `/remote-support` → סטטיסטיקות בראש הספרייה (מספר, MB, בענן).
3. **הורד הכל** — אחרי 2+ הקלטות עם blob; ודאו שהקבצים יורדים ברצף.
4. בחלון נציג — סמנו «התחל הקלטה אוטומטית…»; חיבור + אישור הקלטה מהלקוח → REC מתחיל ללא לחיצה ידנית.
5. **קישור** / **נגן בדף** — פתחו `/remote-support/recordings/play?id=…` באותו דפדפן; ודאו הערה «עובד באותו דפדפן בלבד».
6. העברת קישור לדפדפן אחר — «לא נמצאה» / אין קובץ (צפוי).
7. **העלאה לענן** — tooltip מסביר ענן מדומה; בלי דמו — «זמין רק בדמו» אם נקרא מהקוד.

### RustDesk — ללא שינוי

1. לשונית RustDesk → אשף קיים → מזהה 9 ספרות וכו'.

### שני מכשירים (נציג בדמו / Vercel + לקוח במייל)

1. נציג ב-`https://smart-break-shift-demo.vercel.app` (או `vercel dev` עם `VITE_APP_URL` לדומיין הדמו) → **התחל סשן** → שליחת מייל / העתקת קישור.
2. הקישור כולל `?b=` (bootstrap) — האורח **לא** צריך את אותו `localStorage` כמו הנציג.
3. לקוח פותח ב-Chrome/Edge (גם incognito) → דף אישור, לא «קישור לא תקין».
4. הנציג משאיר מסך הצפייה פתוח; PeerJS מתחבר לפי `sessionId` בנתיב.

**מגבלות דמו (מכשירים נפרדים):** `consentAt` / `recordingActiveAt` ב-localStorage — הנציג לא רואה עדכון אישור מהלקוח בזמן אמת אם הם לא באותו דפדפן; שיתוף הווידאו ב-PeerJS עדיין עובד. הקלטה ותג «מוקלט» אצל האורח — לפי localStorage של האורח בלבד.

**תוקף קישור:** 72 שעות מ-`createdAt` (אחרת «קישור לא תקין או שפג תוקפו»). קישורים ישנים בלי `?b=` — בקשו מהנציג לשלוח קישור חדש.

### קישורי מייל ו-host

| מצב | התנהגות |
|-----|----------|
| נציג על Vercel דמו | `window.location.origin` — תקין |
| נציג על `localhost` + מייל אמיתי | הגדירו `VITE_APP_URL=https://…vercel.app` — אחרת המייל עלול להכיל `127.0.0.1` |
| `getPublicAppOrigin()` | `VITE_APP_URL` (אם מוגדר) או `origin` נוכחי |

פונקציות: `buildScreenShareGuestUrl`, `resolveGuestSession`, `bootstrapGuestSessionFromUrl` ב-`screenShareStore.js`.
