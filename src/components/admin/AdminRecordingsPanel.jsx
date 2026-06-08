import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import {

  Film,

  Loader2,

  Mail,

  Monitor,

  Play,

  Search,

  User,

} from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { demoModeEnabled } from "@/api/demoClient";

import { getRecordingBlob, listStoredRecordingRefs } from "@/lib/demoRecordingStorage";

import {

  groupSupportSessionsByAgentMerged,

  sessionTypeLabel,

  SESSION_TYPES,

  subscribeSupportSessions,

} from "@/lib/supportSessionsLog";

import { recordingUploadStatusLabel } from "@/lib/recordingUpload";
import { buildRecordingPlayId } from "@/lib/screenShareStore";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import {
  cloudRecordingUploadEnabled,
  getSignedRecordingUrl,
} from "@/lib/screenRecordingsSync";



function formatWhen(iso) {

  if (!iso) return "—";

  try {

    return new Date(iso).toLocaleString("he-IL", {

      day: "2-digit",

      month: "2-digit",

      year: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

    });

  } catch {

    return iso;

  }

}



function formatDuration(seconds) {

  const total = Math.max(0, Math.round(seconds || 0));

  const m = Math.floor(total / 60);

  const s = total % 60;

  if (m === 0) return `${s} שניות`;

  if (s === 0) return `${m} דקות`;

  return `${m} דקות ו-${s} שניות`;

}



function sessionMatchesEmail(session, query) {

  if (!query) return true;

  const email = String(session.customerEmail || "").toLowerCase();

  return email.includes(query);

}



function sessionMatchesAgent(session, query) {

  if (!query) return true;

  const name = String(session.agentName || "").toLowerCase();

  return name.includes(query);

}



function filterGroupsByQuery(groups, emailQuery, agentQuery) {

  const email = emailQuery.trim().toLowerCase();

  const agent = agentQuery.trim().toLowerCase();

  if (!email && !agent) return groups;

  return groups

    .map((group) => ({

      ...group,

      sessions: group.sessions.filter(

        (s) => sessionMatchesEmail(s, email) && sessionMatchesAgent(s, agent)

      ),

    }))

    .filter((group) => group.sessions.length > 0);

}



function pickDefaultAgent(groups) {

  if (!groups.length) return "";

  if (groups.length === 1) return groups[0].agentName;

  let bestName = groups[0].agentName;

  let bestTime = 0;

  for (const group of groups) {

    const newest = group.sessions[0]?.createdAt;

    const t = newest ? new Date(newest).getTime() : 0;

    if (t > bestTime) {

      bestTime = t;

      bestName = group.agentName;

    }

  }

  return bestName;

}



function SessionTypeBadge({ sessionType }) {

  const isScreen = sessionType === SESSION_TYPES.SCREEN_SHARE;

  return (

    <span

      className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${

        isScreen

          ? "bg-teal-50 text-teal-900 border border-teal-200"

          : "bg-indigo-50 text-indigo-900 border border-indigo-200"

      }`}

    >

      {isScreen ? <Monitor className="w-3 h-3" /> : <Film className="w-3 h-3" />}

      {sessionTypeLabel(sessionType)}

    </span>

  );

}



function RecordingRow({ recording, hasBlob, hasCloud, onPlay }) {
  const canPlay = hasCloud || hasBlob;
  const status = recording.cloudUploadStatus;
  const statusLabel = status ? recordingUploadStatusLabel(status) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
      <div className="min-w-0">
        <p className="font-medium text-slate-800">
          {formatDuration(recording.durationSec)}
          <span className="text-slate-400 mx-1">·</span>
          {formatWhen(recording.stoppedAt || recording.startedAt)}
        </p>
        {recording.fileSizeBytes ? (
          <p className="text-[10px] text-slate-500 mt-0.5">
            {(recording.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
          </p>
        ) : null}
        {statusLabel ? (
          <p
            className={`text-[10px] mt-0.5 ${
              status === "ready"
                ? "text-emerald-700"
                : status === "failed"
                  ? "text-red-700"
                  : "text-amber-700"
            }`}
          >
            {statusLabel}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canPlay ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => onPlay(recording)}
            >
              <Play className="w-3 h-3" />
              נגן
            </Button>
            <Link
              to={`/admin/recordings/play?id=${buildRecordingPlayId(
                recording.sessionId || "",
                recording.id
              )}`}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50 text-[11px] font-medium"
            >
              <Play className="w-3 h-3" />
              בדף נפרד
            </Link>
          </>
        ) : (
          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
            {recording.cloudPlaceholder || status === "pending" || status === "uploading"
              ? recordingUploadStatusLabel(status || "pending")
              : "אין קובץ וידאו זמין"}
          </span>
        )}
      </div>
    </div>
  );
}



function AgentSessionsList({ group, blobKeys, cloudKeys, onPlayRecording }) {

  const sessionCount = group.sessions.length;

  const recordingCount = group.sessions.reduce((n, s) => n + s.recordings.length, 0);



  return (

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-l from-slate-50 to-white border-b border-slate-100">

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm shrink-0">

          <User className="w-4 h-4 text-white" />

        </div>

        <div className="min-w-0">

          <p className="font-bold text-slate-900 truncate">{group.agentName}</p>

          <p className="text-[11px] text-slate-500">

            {sessionCount} סשנים

            {recordingCount > 0 ? ` · ${recordingCount} הקלטות` : ""}

          </p>

        </div>

      </div>



      <ul className="divide-y divide-slate-100">

        {group.sessions.map((session) => (

          <li key={session.id} className="px-4 py-3 space-y-2">

            <div className="flex flex-wrap items-start justify-between gap-2">

              <div className="min-w-0 space-y-1">

                <div className="flex flex-wrap items-center gap-2">

                  <SessionTypeBadge sessionType={session.sessionType} />

                  <span

                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${

                      session.status === "active"

                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"

                        : "bg-slate-100 text-slate-600 border border-slate-200"

                    }`}

                  >

                    {session.status === "active" ? "פעיל" : "הסתיים"}

                  </span>

                </div>

                <p className="text-sm text-slate-800">{formatWhen(session.createdAt)}</p>

                {session.customerEmail ? (

                  <p className="text-xs text-slate-600 flex items-center gap-1">

                    <Mail className="w-3 h-3 shrink-0" />

                    <span dir="ltr" className="truncate">

                      {session.customerEmail}

                    </span>

                  </p>

                ) : (

                  <p className="text-xs text-slate-400 italic">ללא מייל לקוח</p>

                )}

                <p className="text-[10px] text-slate-400 font-mono" dir="ltr">

                  {session.id}

                </p>

              </div>

            </div>



            {session.sessionType === SESSION_TYPES.SCREEN_SHARE ? (

              session.recordings.length > 0 ? (

                <div className="space-y-1.5 pt-1">

                  {session.recordings.map((rec) => (

                    <RecordingRow

                      key={rec.id}

                      recording={{ ...rec, sessionId: session.id }}

                      hasBlob={blobKeys.has(`${session.id}::${rec.id}`)}
                      hasCloud={
                        rec.cloudReady === true ||
                        cloudKeys.has(`${session.id}::${rec.id}`)
                      }
                      onPlay={(r) => onPlayRecording(session.id, r)}

                    />

                  ))}

                </div>

              ) : (

                <p className="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">

                  {session.recordingActiveAt

                    ? "הקלטה פעילה כעת — הקובץ יופיע לאחר עצירה או סיום הסשן"

                    : session.recordingConsentAt

                      ? "אושרה הקלטה — ממתין להתחלת הקלטה או לסיום הסשן"

                      : "אין הקלטת מסך לסשן זה"}

                </p>

              )

            ) : (

              <p className="text-[11px] text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2">

                סשן RustDesk — אין הקלטת מסך (יומן סשן בלבד)

                {session.rustDeskId ? (

                  <span className="block mt-1 font-mono text-[10px]" dir="ltr">

                    ID: {session.rustDeskId}

                  </span>

                ) : null}

              </p>

            )}

          </li>

        ))}

      </ul>

    </section>

  );

}



export default function AdminRecordingsPanel() {

  const [groups, setGroups] = useState([]);

  const [blobKeys, setBlobKeys] = useState(() => new Set());

  const [loadingBlobs, setLoadingBlobs] = useState(true);

  const [loadingSessions, setLoadingSessions] = useState(true);

  const [emailQuery, setEmailQuery] = useState("");

  const [agentQuery, setAgentQuery] = useState("");

  const [selectedAgent, setSelectedAgent] = useState("");

  const [playOpen, setPlayOpen] = useState(false);

  const [playLoading, setPlayLoading] = useState(false);

  const [playError, setPlayError] = useState("");

  const [playTitle, setPlayTitle] = useState("");

  const [playUrl, setPlayUrl] = useState(null);

  const playUrlRef = useRef(null);
  const playUrlIsBlobRef = useRef(false);

  const filteredGroups = useMemo(

    () => filterGroupsByQuery(groups, emailQuery, agentQuery),

    [groups, emailQuery, agentQuery]

  );



  const selectedGroup = useMemo(

    () => filteredGroups.find((g) => g.agentName === selectedAgent) || null,

    [filteredGroups, selectedAgent]

  );



  const revokePlayUrl = useCallback(() => {
    if (playUrlRef.current && playUrlIsBlobRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
    }
    playUrlRef.current = null;
    playUrlIsBlobRef.current = false;
    setPlayUrl(null);
  }, []);



  const refresh = useCallback(async () => {

    setLoadingSessions(true);

    try {

      setGroups(await groupSupportSessionsByAgentMerged());

    } catch {

      setGroups([]);

    } finally {

      setLoadingSessions(false);

    }

    setLoadingBlobs(true);

    try {

      const refs = await listStoredRecordingRefs();

      setBlobKeys(new Set(refs.map((r) => `${r.sessionId}::${r.recordingId}`)));

    } catch {

      setBlobKeys(new Set());

    } finally {

      setLoadingBlobs(false);

    }

  }, []);



  useEffect(() => {

    refresh();

    return subscribeSupportSessions(() => {

      refresh();

    });

  }, [refresh]);



  useEffect(() => () => revokePlayUrl(), [revokePlayUrl]);



  useEffect(() => {

    if (filteredGroups.length === 0) {

      setSelectedAgent("");

      return;

    }

    const stillValid = filteredGroups.some((g) => g.agentName === selectedAgent);

    if (stillValid) return;

    setSelectedAgent(pickDefaultAgent(filteredGroups));

  }, [filteredGroups, selectedAgent]);



  const handlePlay = async (sessionId, rec) => {
    revokePlayUrl();
    setPlayError("");
    setPlayTitle(
      `${formatDuration(rec.durationSec)} · ${formatWhen(rec.stoppedAt || rec.startedAt)}`
    );
    setPlayOpen(true);
    setPlayLoading(true);

    try {
      if (rec.cloudReady && rec.storagePath) {
        const signedUrl = await getSignedRecordingUrl(rec.storagePath);
        if (signedUrl) {
          playUrlRef.current = signedUrl;
          playUrlIsBlobRef.current = false;
          setPlayUrl(signedUrl);
          return;
        }
      }

      const blob = await getRecordingBlob(sessionId, rec.id);
      if (!blob?.size) {
        setPlayError(
          cloudRecordingUploadEnabled()
            ? recordingUploadStatusLabel(rec.cloudUploadStatus || "pending")
            : "אין קובץ וידאו במכשיר זה — ההקלטה נשמרה בדפדפן הנציג"
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      playUrlRef.current = url;
      playUrlIsBlobRef.current = true;
      setPlayUrl(url);
    } catch (err) {
      setPlayError(err?.message || "לא ניתן לטעון את ההקלטה");
    } finally {
      setPlayLoading(false);
    }
  };



  const handlePlayClose = (open) => {

    if (!open) {

      revokePlayUrl();

      setPlayError("");

      setPlayLoading(false);

    }

    setPlayOpen(open);

  };



  const totalSessions = filteredGroups.reduce((n, g) => n + g.sessions.length, 0);

  const hasEmailFilter = emailQuery.trim().length > 0;

  const hasAgentFilter = agentQuery.trim().length > 0;

  const cloudSync = cloudSessionSyncEnabled();
  const cloudUpload = cloudRecordingUploadEnabled();

  const cloudKeys = useMemo(() => {
    const keys = new Set();
    for (const group of groups) {
      for (const session of group.sessions) {
        for (const rec of session.recordings || []) {
          if (rec.cloudReady && rec.storagePath) {
            keys.add(`${session.id}::${rec.id}`);
          }
        }
      }
    }
    return keys;
  }, [groups]);

  return (

    <div className="space-y-4" dir="rtl">

      <p className="text-xs text-slate-600 leading-relaxed rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">

        {cloudSync ? (
          cloudUpload ? (
            <>
              יומן הסשנים והקלטות מסונכרנים ל-Supabase — מנהל רואה סשנים מכל הנציגים.
              וידאו נשמר ב-bucket <strong>screen-recordings</strong> ונגן דרך קישור חתום מהשרת.
            </>
          ) : (
            <>
              יומן הסשנים מסונכרן ל-Supabase — מנהל רואה סשנים מכל הנציגים.
              קבצי וידאו נשמרים ב-IndexedDB של <strong>דפדפן הנציג</strong> בלבד.
            </>
          )
        ) : (

          <>

            יומן הסשנים וההקלטות נשמר ב-localStorage ו-IndexedDB של{" "}

            <strong>דפדפן זה</strong>. מנהל רואה סשנים שנרשמו במחשב שבו נפתחה לשונית זו.

          </>

        )}

        {demoModeEnabled ? " במצב דמו — כולל CRM." : ""}

      </p>



      {groups.length > 0 && (

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

          <div className="space-y-1.5">

            <label htmlFor="recordings-agent-search" className="text-xs font-medium text-slate-700">

              חיפוש לפי שם נציג

            </label>

            <div className="relative">

              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

              <Input

                id="recordings-agent-search"

                type="search"

                placeholder="אוראל"

                value={agentQuery}

                onChange={(e) => setAgentQuery(e.target.value)}

                className="pr-9"

              />

            </div>

          </div>



          <div className="space-y-1.5">

            <label htmlFor="recordings-email-search" className="text-xs font-medium text-slate-700">

              חיפוש לפי מייל לקוח

            </label>

            <div className="relative">

              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

              <Input

                id="recordings-email-search"

                type="search"

                dir="ltr"

                placeholder="customer@example.com"

                value={emailQuery}

                onChange={(e) => setEmailQuery(e.target.value)}

                className="pr-9 text-left"

              />

            </div>

          </div>



          <div className="space-y-1.5">

            <label htmlFor="recordings-agent-select" className="text-xs font-medium text-slate-700">

              בחר נציג

            </label>

            <Select

              value={selectedAgent || undefined}

              onValueChange={setSelectedAgent}

              disabled={filteredGroups.length === 0}

            >

              <SelectTrigger id="recordings-agent-select" className="text-right">

                <SelectValue placeholder="בחר נציג" />

              </SelectTrigger>

              <SelectContent dir="rtl">

                {filteredGroups.map((group) => (

                  <SelectItem key={group.agentName} value={group.agentName}>

                    {group.agentName}

                    <span className="text-slate-400 mr-1">({group.sessions.length})</span>

                  </SelectItem>

                ))}

              </SelectContent>

            </Select>

          </div>

        </div>

      )}



      <div className="flex flex-wrap gap-3 text-xs text-slate-600">

        {loadingSessions ? (

          <span className="inline-flex items-center gap-1">

            <Loader2 className="w-3 h-3 animate-spin" />

            טוען סשנים…

          </span>

        ) : null}

        <span>

          <strong className="text-slate-800">{filteredGroups.length}</strong> נציגים

          {hasEmailFilter && groups.length !== filteredGroups.length ? (

            <span className="text-slate-400"> / {groups.length}</span>

          ) : null}

          {hasAgentFilter && !hasEmailFilter && groups.length !== filteredGroups.length ? (

            <span className="text-slate-400"> / {groups.length}</span>

          ) : null}

        </span>

        <span className="text-slate-300">·</span>

        <span>

          <strong className="text-slate-800">{totalSessions}</strong> סשנים

        </span>

        {loadingBlobs ? (

          <>

            <span className="text-slate-300">·</span>

            <span className="inline-flex items-center gap-1">

              <Loader2 className="w-3 h-3 animate-spin" />

              בודק קבצי וידאו…

            </span>

          </>

        ) : (

          <>

            <span className="text-slate-300">·</span>

            <span>
              <strong className="text-slate-800">{blobKeys.size}</strong> קבצים מקומיים
            </span>
            {cloudUpload ? (
              <>
                <span className="text-slate-300">·</span>
                <span>
                  <strong className="text-slate-800">{cloudKeys.size}</strong> בשרת
                </span>
              </>
            ) : null}

          </>

        )}

      </div>



      {loadingSessions ? (

        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-dashed border-slate-200">

          <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />

          טוען יומן סשנים…

        </p>

      ) : groups.length === 0 ? (

        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-dashed border-slate-200">

          אין סשני תמיכה עדיין. סשנים יופיעו לאחר שימוש ב«השתלטות מרחוק».

        </p>

      ) : filteredGroups.length === 0 ? (

        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-dashed border-slate-200">

          לא נמצאו סשנים התואמים לחיפוש

          {hasEmailFilter ? ` «${emailQuery.trim()}»` : ""}

          {hasAgentFilter ? ` «${agentQuery.trim()}»` : ""}.

        </p>

      ) : !selectedGroup ? (

        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-dashed border-slate-200">

          בחר נציג מהרשימה כדי לצפות בסשנים וההקלטות שלו.

        </p>

      ) : (

        <AgentSessionsList

          group={selectedGroup}

          blobKeys={blobKeys}
          cloudKeys={cloudKeys}
          onPlayRecording={handlePlay}

        />

      )}



      <Dialog open={playOpen} onOpenChange={handlePlayClose}>

        <DialogContent className="sm:max-w-2xl" dir="rtl">

          <DialogHeader>

            <DialogTitle>נגן הקלטה</DialogTitle>

            <DialogDescription>{playTitle || "הקלטת מסך"}</DialogDescription>

          </DialogHeader>

          {playLoading && (

            <p className="text-sm text-slate-600 text-center py-8">טוען וידאו…</p>

          )}

          {!playLoading && playError && (

            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-4 text-center">

              {playError}

            </p>

          )}

          {!playLoading && !playError && playUrl && (

            <video

              src={playUrl}

              controls

              playsInline

              className="w-full rounded-lg bg-black aspect-video"

            />

          )}

        </DialogContent>

      </Dialog>

    </div>

  );

}

