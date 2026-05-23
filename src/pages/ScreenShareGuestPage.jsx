import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Peer from "peerjs";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Monitor,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getSession,
  logScreenConsent,
  screenShareDemoAvailable,
  subscribeScreenShare,
} from "@/lib/screenShareStore";

const DEMO_BANNER =
  "דמו — שיתוף מסך בדפדפן (צפייה בלבד). מומלץ Chrome או Edge. לפרודקשן: PeerServer עצמי.";

export default function ScreenShareGuestPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(() => getSession(sessionId));
  const [consentChecked, setConsentChecked] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const refresh = () => setSession(getSession(sessionId));
    refresh();
    return subscribeScreenShare(refresh);
  }, [sessionId]);

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
        audio: false,
      });
      streamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setShared(false);
        setError("שיתוף המסך הופסק מהדפדפן");
      });

      logScreenConsent(session.id);
      setSession(getSession(sessionId));

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
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50" dir="rtl">
        <p className="text-slate-600 text-center">שיתוף מסך זמין במצב דמו בלבד.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4"
      dir="rtl"
    >
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
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-800">המסך משותף לנציג</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                השאירו דף זה פתוח. לעצירה — לחצו «הפסק שיתוף» בחלון הדפדפן או סגרו את
                השיתוף.
              </p>
            </div>
          ) : (
            <>
              <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 rounded-xl p-3 border border-slate-100 leading-relaxed">
                <li>השתמשו ב-Chrome או Edge (מומלץ)</li>
                <li>סמנו אישור למטה</li>
                <li>לחצו «אני מאשר ומשתף מסך»</li>
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
                  אני מאשר/ת שנציג התמיכה יצפה במסך שלי בדפדפן לצורך טיפול בתקלה — ללא
                  שליטה בעכבר או במקלדת
                </span>
              </label>

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
                {sharing ? "מתחבר לנציג…" : "אני מאשר ומשתף מסך"}
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
