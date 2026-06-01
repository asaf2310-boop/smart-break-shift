import React, { useCallback, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { ArrowRight, FileUp, GraduationCap, Link2, Trash2, Upload } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { m3PageClass } from "@/lib/hypPage";

import { resolveTrainingSchedule } from "@/lib/trainingSchedule";

import {

  getExternalLink,

  listPresentationAvailability,

  removeExternalLink,

  removeTrainingPresentation,

  setExternalLink,

  uploadTrainingPresentation,

} from "@/lib/trainingPresentations";

import { supabaseConfigured } from "@/api/supabase";



export default function AdminTraining() {

  const schedule = useMemo(() => resolveTrainingSchedule(), []);

  const teachableSessions = useMemo(

    () => schedule.sessions.filter((s) => !s.isBreak),

    [schedule.sessions]

  );

  const sessionIds = useMemo(() => teachableSessions.map((s) => s.id), [teachableSessions]);



  const [availability, setAvailability] = useState({});

  const [urlDrafts, setUrlDrafts] = useState({});

  const [uploadingId, setUploadingId] = useState(null);

  const fileInputRefs = useRef({});

  const { toast } = useToast();



  const refreshAvailability = useCallback(async () => {

    const map = await listPresentationAvailability(sessionIds);

    setAvailability(map);

    setUrlDrafts((prev) => {

      const next = { ...prev };

      sessionIds.forEach((id) => {

        if (next[id] === undefined) {

          next[id] = getExternalLink(id) || "";

        }

      });

      return next;

    });

  }, [sessionIds]);



  React.useEffect(() => {

    refreshAvailability();

  }, [refreshAvailability]);



  const handleFile = async (sessionId, file) => {

    if (!file) return;

    setUploadingId(sessionId);

    try {

      const result = await uploadTrainingPresentation(sessionId, file);

      if (result.ok) {

        toast({ title: "הועלה בהצלחה", description: result.message });

        await refreshAvailability();

      } else {

        toast({

          title: result.message,

          description: result.description,

          variant: result.description ? "default" : "destructive",

        });

      }

    } catch {

      toast({ title: "שגיאה", description: "העלאה נכשלה" });

    } finally {

      setUploadingId(null);

      const input = fileInputRefs.current[sessionId];

      if (input) input.value = "";

    }

  };



  const handleRemovePdf = async (sessionId) => {

    setUploadingId(sessionId);

    try {

      await removeTrainingPresentation(sessionId);

      toast({ title: "המצגת הוסרה מהאחסון המקומי/ענן" });

      await refreshAvailability();

    } finally {

      setUploadingId(null);

    }

  };



  const handleSaveUrl = (sessionId) => {

    const result = setExternalLink(sessionId, urlDrafts[sessionId]);

    if (result.ok) {

      toast({ title: result.message });

      refreshAvailability();

    } else {

      toast({

        title: result.message,

        description: result.description,

        variant: result.description ? "default" : "destructive",

      });

    }

  };



  const handleRemoveUrl = (sessionId) => {

    removeExternalLink(sessionId);

    setUrlDrafts((prev) => ({ ...prev, [sessionId]: "" }));

    toast({ title: "הקישור הוסר" });

    refreshAvailability();

  };



  return (

    <div className={m3PageClass("min-h-screen")} dir="rtl">

      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6 gap-4">

          <div className="flex items-center gap-3 min-w-0">

            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-elevation-2 shrink-0">

              <GraduationCap className="w-6 h-6 text-primary-foreground" />

            </div>

            <div className="min-w-0">

              <h1 className="m3-headline-small text-xl font-semibold">ניהול מצגות הדרכה</h1>

              <p className="m3-label-medium">PDF או קישור חיצוני לכל מפגש — הנציגים נפתחים מהלוח</p>

            </div>

          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">

            <Link to="/admin" className="m3-btn-outlined text-xs py-2">

              <ArrowRight className="w-4 h-4" />

              חזרה

            </Link>

            <Link to="/training" className="text-xs text-primary hover:underline">

              תצוגת נציג

            </Link>

          </div>

        </div>



        <motion.div

          initial={{ opacity: 0, y: 8 }}

          animate={{ opacity: 1, y: 0 }}

          className="m3-card p-4 mb-6 text-sm text-on-surface-variant space-y-2 border border-primary/15"

        >

          <p className="font-medium text-on-surface">איך זה עובד</p>

          <ul className="list-disc list-inside space-y-1 m-0">

            <li>לכל מפגש: PDF (מצגת) ו/או קישור לאינטרנט (http/https).</li>

            <li>בלחיצת נציג: אם יש קישור — מעבר אליו; אחרת מצגת PDF.</li>

            <li>

              {supabaseConfigured

                ? "Supabase מוגדר: הקבצים נשמרים ב-bucket `training-docs`."

                : "ללא Supabase: הקבצים נשמרים בדפדפן (IndexedDB) לבדיקות מקומיות."}

            </li>

            <li>

              קישורים נשמרים ב-localStorage; לפריסה קבועה: הוסיפו ל־

              <code className="text-xs bg-surface-container-high px-1 rounded">

                trainingPresentations.json

              </code>{" "}

              תחת <code className="text-xs bg-surface-container-high px-1 rounded">links</code>.

            </li>

            <li>PowerPoint (pptx): ייצאו ל-PDF לפני העלאה — אין המרה בדפדפן.</li>

          </ul>

        </motion.div>



        <div className="space-y-3">

          {teachableSessions.map((session, index) => {

            const status = availability[session.id] || { hasPdf: false, hasUrl: false };

            const busy = uploadingId === session.id;

            const urlDraft = urlDrafts[session.id] ?? "";



            return (

              <motion.div

                key={session.id}

                initial={{ opacity: 0, x: 8 }}

                animate={{ opacity: 1, x: 0 }}

                transition={{ delay: index * 0.02 }}

                className="m3-surface-container p-4 rounded-2xl flex flex-col gap-3"

              >

                <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                  <div className="flex-1 min-w-0">

                    <p className="text-xs text-primary font-mono tabular-nums">{session.timeLabel}</p>

                    <p className="font-medium text-sm sm:text-base truncate">{session.title}</p>

                    <p className="text-xs text-on-surface-variant mt-0.5">

                      {session.date.split("-").reverse().join(".")} · מזהה:{" "}

                      <code className="text-[11px]">{session.id}</code>

                    </p>

                  </div>



                  <div className="flex flex-wrap items-center gap-2 shrink-0">

                    {status.hasPdf ? (

                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">

                        מצגת

                      </span>

                    ) : null}

                    {status.hasUrl ? (

                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">

                        <Link2 className="w-3 h-3" />

                        קישור

                      </span>

                    ) : null}

                    {!status.hasPdf && !status.hasUrl ? (

                      <span className="text-xs px-2 py-0.5 rounded-full bg-outline-variant/20 text-on-surface-variant">

                        אין תוכן

                      </span>

                    ) : null}

                  </div>

                </div>



                <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-3">

                  <label className="text-xs font-medium text-on-surface-variant">קישור חיצוני</label>

                  <div className="flex flex-col sm:flex-row gap-2">

                    <input

                      type="url"

                      dir="ltr"

                      placeholder="https://..."

                      value={urlDraft}

                      onChange={(e) =>

                        setUrlDrafts((prev) => ({ ...prev, [session.id]: e.target.value }))

                      }

                      className="flex-1 min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm"

                    />

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => handleSaveUrl(session.id)}

                      className="m3-btn-outlined text-xs py-2 shrink-0"

                    >

                      שמירת קישור

                    </button>

                    {status.hasUrl ? (

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() => handleRemoveUrl(session.id)}

                        className="m3-btn-outlined text-xs py-2 text-destructive border-destructive/30 shrink-0"

                      >

                        הסרת קישור

                      </button>

                    ) : null}

                  </div>

                </div>



                <div className="flex flex-wrap items-center gap-2">

                  <input

                    ref={(el) => {

                      fileInputRefs.current[session.id] = el;

                    }}

                    type="file"

                    accept=".pdf,application/pdf,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"

                    className="hidden"

                    onChange={(e) => handleFile(session.id, e.target.files?.[0])}

                  />



                  <button

                    type="button"

                    disabled={busy}

                    onClick={() => fileInputRefs.current[session.id]?.click()}

                    className="m3-btn-primary text-xs py-2 gap-1.5"

                  >

                    {busy ? (

                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />

                    ) : (

                      <Upload className="w-4 h-4" />

                    )}

                    העלאת PDF

                  </button>



                  {status.hasPdf ? (

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => handleRemovePdf(session.id)}

                      className="m3-btn-outlined text-xs py-2 text-destructive border-destructive/30"

                      aria-label="הסרת מצגת"

                    >

                      <Trash2 className="w-4 h-4" />

                    </button>

                  ) : null}

                </div>

              </motion.div>

            );

          })}

        </div>



        <p className="m3-label-medium text-center mt-8 flex items-center justify-center gap-1">

          <FileUp className="w-4 h-4" />

          PDF = מצגת בשקפים · קישור = מעבר ישיר בלחיצה

        </p>

      </div>

    </div>

  );

}

