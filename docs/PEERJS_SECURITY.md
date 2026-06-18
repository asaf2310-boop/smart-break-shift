# PeerJS / WebRTC — הנחיות אבטחה (Phase 15 + 21)

## סקירה

שיתוף מסך משתמש ב-[PeerJS](https://peerjs.com/) לסיגנלינג WebRTC. ברירת המחדל היא **PeerServer הציבורי** — מתאים לדמו בלבד.

**Phase 21:** באתחול האפליקציה (`main.jsx`) — אזהרת console אם build פרודקשן ללא `VITE_PEERJS_HOST`.

## מה מיושם באפליקציה

| מנגנון | פירוט |
|--------|--------|
| **מזהה Peer אקראי** | הנציג יוצר `new Peer()` עם מזהה אקראי (לא `sessionId`) — `agentPeerManager.js` |
| **פרסום מזהה** | `agent_peer_id` נשמר ב-`support_sessions` (Supabase) + sessionStorage |
| **אימות מזהה אצל אורח** | האורח ממתין ל-`agentPeerId` מהענן/מאגר הסשן; דוחה מזהה שזהה ל-`sessionId` |
| **טוקן join** | `WEBRTC_JOIN_REQUIRE` + `mintWebrtcJoinToken` — ICE/TURN דורש אימות סשן |
| **פקיעת Peer ישנים** | `AGENT_PEER_MAX_AGE_MS` — ניקוי client-side של Peers שלא בשימוש |
| **קישור אורח** | טוקן חתום, חד-פעמי (phase 14), fingerprint ל-IP+UA |

## פרודקשן — מומלץ

1. **PeerServer עצמי** — הגדירו `VITE_PEERJS_HOST`, `VITE_PEERJS_PATH`, `VITE_PEERJS_SECURE=true`
2. **TURN** — `TURN_URL` / `ICE_SERVERS` ב-Vercel (לא ב-build)
3. **אל תשתמשו** ב-PeerJS Cloud לנתונים רגישים
4. **HTTPS חובה** — WebRTC דורש הקשר מאובטח

## משתני סביבה

```env
VITE_PEERJS_HOST=peer.example.com
VITE_PEERJS_PATH=/peerjs
VITE_PEERJS_KEY=peerjs
VITE_PEERJS_PORT=443
VITE_PEERJS_SECURE=true
WEBRTC_JOIN_REQUIRE=true
WEBRTC_JOIN_TTL_SEC=900
```

## מגבלות ידועות (עתיד)

- אין אימות שרת על מזהה Peer ב-PeerServer הציבורי — תוקף יכול לנחש מזהה אם דלף
- **PeerServer עצמי** — דורש פריסת `peerjs-server` + משתני `VITE_PEERJS_*` (ראו למעלה)
- SIP proxy — לא במסגרת phase 21 (ראו `SIP_SECURITY.md`)
- סריקת AV לקבצים — אופציונלי

ראו גם: [REMOTE_SUPPORT.md](./REMOTE_SUPPORT.md), [TELEPHONY_SETUP.md](./TELEPHONY_SETUP.md)
