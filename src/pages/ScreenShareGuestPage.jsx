import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Peer from "peerjs";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Monitor,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  logRecordingConsent,
  logScreenConsent,
  GUEST_BOOTSTRAP_QUERY_KEY,
  resolveGuestSession,
  screenShareDemoAvailable,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import { m3PageClass } from "@/lib/hypPage";

const DEMO_BANNER =
  "דמו — שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge. לפרודקשן: PeerServer עצמי.";

/** אודיו מערכת ב-getDisplayMedia — בדרך כלל Chrome/Edge בדסקטופ */
function displayMediaSystemAudioSupported() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return false;
  }
  const ua = navigator.userAgent;
  return /Chrome|Edg/.test(ua) && !/Firefox/i.test(ua);
}

export default function ScreenShareGuestPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const bootstrapKey = searchParams.get(GUEST_BOOTSTRAP_QUERY_KEY);
  const [session, setSession] = useState(() =>
    resolveGuestSession(sessionId, bootstrapKey)
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [recordingConsentChecked, setRecordingConsentChecked] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const systemAudioSupported = displayMediaSystemAudioSupported();
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const refresh = () => setSession(resolveGuestSession(sessionId, bootstrapKey));
    refresh();
    return subscribeScreenShare(refresh);
  }, [sessionId, bootstrapKey]);

  useEffect(() => {
    if (!shared || !sessionId) return undefined;
    let intervalMs = 1500;
    let timer;
    const tick = () => {
      const latest = resolveGuestSession(sessionId, bootstrapKey);
      setSession(latest);
      const nextMs =
        latest?.recordingConsentAt && latest?.recordingActiveAt ? 500 : 1500;
      if (nextMs !== intervalMs) {
        intervalMs = nextMs;
        clearInterval(timer);
        timer = setInterval(tick, intervalMs);
      }
    };
    tick();
    timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [shared, sessionId, bootstrapKey]);

  useEffect(() => {
    return () => {
      try {
        callRef.current?.close();
        peerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleShareScreen = async () => {
    if (!session || session.status === "ended") return;
    if (!consentChecked) {
      setError("יש לאשר את תנאי שיתוף המסך לפני המשך");
      return;
    }

    setError("");
    setSharing(true);

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          "הדפדפן אינו תומך בשיתוף מסך. נסו Chrome או Edge בגרסה עדכנית."
        );
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: includeSystemAudio && systemAudioSupported,
      });
      streamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setShared(false);
        setError("שיתוף המסך הופסק מהדפדפן");
      });

      logScreenConsent(session.id);
      if (recordingConsentChecked) {
        logRecordingConsent(session.id);
      }
      setSession(resolveGuestSession(sessionId, bootstrapKey));

      const peer = new Peer({ debug: 0 });
      peerRef.current = peer;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("תם הזמן להתחברות לנציג — ודאו שהנציג פתח את מסך הצפייה")),
          45000
        );
        peer.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        peer.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const call = peer.call(sessionId, stream);
      callRef.current = call;

      call.on("close", () => {
        setShared(false);
      });

      call.on("error", () => {
        setError("החיבור לנציג נותק");
        setShared(false);
      });

      setShared(true);
    } catch (err) {
      const name = err?.name || "";
      let message = err?.message || "לא ניתן לשתף מסך";
      if (name === "NotAllowedError") {
        message = "הרשאת שיתוף מסך נדחתה — אשרו בחלון הדפדפן ונסו שוב";
      } else if (name === "NotFoundError") {
        message = "לא נבחר מסך לשיתוף";
      }
      setError(message);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        peerRef.current?.destroy();
      } catch {
        /* ignore */
      }
    } finally {
      setSharing(false);
    }
  };

  if (!screenShareDemoAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <p className="text-slate-600 text-center">שיתוף מסך זמין במצב דמו בלבד.</p>
      </div>
    );
  }

  const showRecordingWatermark =
    shared && Boolean(session?.recordingConsentAt && session?.recordingActiveAt);

  return (
    <div className={m3PageClass("flex items-center justify-center p-4 relative")} dir="rtl">
      {showRecordingWatermark && (
        <div
          className="fixed bottom-4 left-4 z-50 pointer-events-none select-none text-sm font-semibold text-slate-800/45 tracking-wide"
          role="status"
          aria-live="polite"
        >
          מוקלט
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden"
      >
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2 text-amber-950 text-xs leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{DEMO_BANNER}</span>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 mb-3">
              <Monitor className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">שיתוף מסך לתמיכה</h1>
            <p className="text-sm text-slate-500 mt-1">צפייה בלבד — ללא שליטה בעכבר</p>
          </div>

          {!session ? (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>קישור לא תקין או שפג תוקפו. בקשו מהנציג קישור חדש.</p>
            </div>
          ) : session.status === "ended" ? (
            <p className="text-sm text-center text-slate-600">סשן שיתוף המסך הסתיים.</p>
          ) : shared ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-800">המסך משותף לנציג</p>
              {session.recordingConsentAt && session.recordingActiveAt && (
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800"
                  role="status"
                  aria-live="polite"
                >
                  <Circle className="w-2.5 h-2.5 fill-red-600 text-red-600 animate-pulse" />
                  המסך מוקלט
                </div>
              )}
              <p className="text-xs text-slate-500 leading-relaxed">
                השאירו דף זה פתוח. לעצירה — לחצו «הפסק שיתוף» בחלון הדפדפן או סגרו את
                השיתוף.
              </p>
            </div>
          ) : (
            <>
              <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed">
                <li>השתמשו ב-Chrome או Edge (מומלץ)</li>
                <li>סמנו «אני מאשר שיתוף מסך»</li>
                <li>אם הנציג עשוי להקליט — סמנו גם «אישור הקלטה» (אופציונלי לצפייה בלבד)</li>
                <li>לחצו «התחל שיתוף מסך»</li>
                <li>בחרו מסך, חלון או לשונית לשיתוף</li>
              </ol>

              {session.agentName && (
                <p className="text-xs text-slate-500 text-center">
                  נציג: {session.agentName}
                </p>
              )}

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-teal-200 bg-teal-50/40 p-3">
                <Checkbox
                  checked={consentChecked}
                  onCheckedChange={(v) => setConsentChecked(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium text-slate-800 leading-relaxed">
                  אני מאשר שיתוף מסך — נציג התמיכה יצפה במסך שלי בדפדפן לצורך טיפול בתקלה
                  בלבד, ללא שליטה בעכבר או במקלדת
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                <Checkbox
                  checked={recordingConsentChecked}
                  onCheckedChange={(v) => setRecordingConsentChecked(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium text-slate-800 leading-relaxed">
                  אני מאשר שהנציג יוכל להקליט את שיתוף המסך לצורך תיעוד הטיפול (דמו) — הקובץ
                  נשמר אצל הנציג בלבד ולא נשלח אוטומטית לשרת
                </span>
              </label>

              {systemAudioSupported && (
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <Checkbox
                    checked={includeSystemAudio}
                    onCheckedChange={(v) => setIncludeSystemAudio(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed">
                    כלול אודיו מערכת (אופציונלי) — יש לסמן גם «שתף אודיו» בחלון הדפדפן. ברירת מחדל:
                    ללא אודיו.
                  </span>
                </label>
              )}

              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="button"
                onClick={handleShareScreen}
                disabled={!consentChecked || sharing}
                className="w-full h-12 text-base bg-gradient-to-l from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              >
                {sharing ? "מתחבר לנציג…" : "התחל שיתוף מסך"}
              </Button>
            </>
          )}

          <p className="text-center">
            <Link to="/" className="text-xs text-teal-600 hover:underline">
              חזרה לדף הבית
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
