import React, { useState, useMemo, useRef, useEffect } from "react";
import { dataClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { motion } from "framer-motion";
import { Zap, Sun, Moon, Check, X, RefreshCw, Plus, MessageSquare } from "lucide-react";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
import {
  AGENT_NAMES,
  HOLIDAY_EVE_DATES,
  MAX_MORNING_AUTO_ASSIGNMENTS_PER_WEEK,
} from "@/constants/scheduling";
import {
  resendScheduleSmsNotifications,
  sendScheduleSmsNotifications,
  toastScheduleSmsResult,
} from "@/lib/scheduleSms";
import { refreshScheduleQueriesAfterPublish } from "@/lib/shiftScheduleQuery";
import { useToast } from "@/components/ui/use-toast";
import { demoModeEnabled } from "@/api/demoClient";

// Auto-schedule algorithm:
// - רק נציגים שאישרו אילוצים (אם יש אישורים בשבוע)
// - לא זמין = סימון "לא זמין" / חופש מאושר לאותה משמרת
// - עדיפות לערב 09:00–17:00; בוקר 08:00–16:00 רק אם סימנו לא זמין בערב או לכיסוי מינימלי
// - לכל היותר MAX_MORNING_AUTO_ASSIGNMENTS_PER_WEEK משמרות בוקר לנציג בשבוע
// - נציג אחד לכל היותר במשמרת אחת ביום
function buildAutoSchedule(weekDays, unavailabilities, vacationRequests, confirmedAgentNames = new Set()) {
  const schedule = {};
  const agentMorningCount = Object.fromEntries(AGENT_NAMES.map(n => [n, 0]));
  const agentEveningCount = Object.fromEntries(AGENT_NAMES.map(n => [n, 0]));

  const schedulingPool =
    confirmedAgentNames.size > 0
      ? AGENT_NAMES.filter((n) => confirmedAgentNames.has(n))
      : [...AGENT_NAMES];

  const isShiftUnavailable = (agentName, dateStr, shiftType) => {
    const onVacation = vacationRequests.some(
      (v) => v.agent_name === agentName && v.date === dateStr && v.status === "approved"
    );
    if (onVacation) return true;
    return unavailabilities.some(
      (u) =>
        u.agent_name === agentName &&
        u.date === dateStr &&
        u.shift_type === shiftType
    );
  };

  const canAssignMorning = (name) =>
    agentMorningCount[name] < MAX_MORNING_AUTO_ASSIGNMENTS_PER_WEEK;

  for (const date of weekDays) {
    const dateStr = format(date, "yyyy-MM-dd");
    const isHolidayEve = HOLIDAY_EVE_DATES.includes(dateStr);

    if (isHolidayEve) {
      // Only agents who confirmed constraints AND did not mark themselves unavailable/vacation for either shift
      const isUnavailableHoliday = (agentName) => {
        const onVacation = vacationRequests.some(v => v.agent_name === agentName && v.date === dateStr && v.status === "approved");
        if (onVacation) return true;
        return unavailabilities.some(u => u.agent_name === agentName && u.date === dateStr);
      };
      const available = schedulingPool.filter(
        (n) => confirmedAgentNames.has(n) && !isUnavailableHoliday(n)
      );
      schedule[`${dateStr}|holiday_eve`] = available;
      continue;
    }

    const availMorning = schedulingPool.filter((n) => !isShiftUnavailable(n, dateStr, "morning"));
    const availEvening = schedulingPool.filter((n) => !isShiftUnavailable(n, dateStr, "evening"));

    const onlyMorning = schedulingPool.filter(
      (n) => availMorning.includes(n) && !availEvening.includes(n)
    );
    const onlyEvening = schedulingPool.filter(
      (n) => !availMorning.includes(n) && availEvening.includes(n)
    );
    const bothAvail = schedulingPool.filter(
      (n) => availMorning.includes(n) && availEvening.includes(n)
    );

    const morningAgents = [...onlyMorning];
    const eveningAgents = [...onlyEvening];

    const bothSortedForEvening = [...bothAvail].sort((a, b) => {
      const biasA = agentMorningCount[a] - agentEveningCount[a];
      const biasB = agentMorningCount[b] - agentEveningCount[b];
      return biasB - biasA;
    });
    eveningAgents.push(...bothSortedForEvening);

    const morningEligibleCount =
      onlyMorning.length + bothAvail.filter(canAssignMorning).length;
    const morningTarget =
      morningEligibleCount > 0 ? Math.max(onlyMorning.length, 1) : 0;
    let morningStillNeeded = Math.max(0, morningTarget - morningAgents.length);

    if (morningStillNeeded > 0) {
      const sortForMorning = (a, b) => {
        const morningDiff = agentMorningCount[a] - agentMorningCount[b];
        if (morningDiff !== 0) return morningDiff;
        return agentEveningCount[b] - agentEveningCount[a];
      };
      let candidatesForMorning = bothSortedForEvening
        .filter((name) => eveningAgents.includes(name) && canAssignMorning(name))
        .sort(sortForMorning);
      if (!candidatesForMorning.length) {
        candidatesForMorning = bothSortedForEvening
          .filter((name) => eveningAgents.includes(name))
          .sort(sortForMorning);
      }

      for (const name of candidatesForMorning) {
        if (morningStillNeeded <= 0) break;
        const idx = eveningAgents.indexOf(name);
        if (idx === -1) continue;
        eveningAgents.splice(idx, 1);
        morningAgents.push(name);
        morningStillNeeded--;
      }
    }

    schedule[`${dateStr}|morning`] = morningAgents;
    schedule[`${dateStr}|evening`] = eveningAgents;
    morningAgents.forEach((n) => {
      agentMorningCount[n]++;
    });
    eveningAgents.forEach((n) => {
      agentEveningCount[n]++;
    });
  }

  return schedule;
}

export { buildAutoSchedule };

function NotePopover({ note, onSave, color = "indigo" }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note || "");
  const ref = useRef(null);

  useEffect(() => {
    setText(note || "");
  }, [note]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasNote = !!note;
  const iconColor = color === "purple"
    ? (hasNote ? "text-purple-600" : "text-purple-300 hover:text-purple-500")
    : (hasNote ? "text-indigo-600" : "text-indigo-300 hover:text-indigo-500");

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={hasNote ? note : "הוסף הערה"}
        className={`transition-colors ${iconColor}`}
      >
        {hasNote ? (
          <MessageSquare className="w-3 h-3 fill-current" />
        ) : (
          <MessageSquare className="w-3 h-3" />
        )}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="הערה..."
            rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 resize-none text-right"
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => { onSave(text); setOpen(false); }}
              className="flex-1 py-1 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-600 transition-colors"
            >
              שמור
            </button>
            {hasNote && (
              <button
                onClick={() => { onSave(""); setText(""); setOpen(false); }}
                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-400 text-xs hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Agents not already listed in this shift cell (same cell only — not day-wide). */
function agentsAvailableForCell(cellAgents) {
  return AGENT_NAMES.filter((name) => !cellAgents.includes(name));
}

function ShiftCell({
  cellKey,
  agents,
  notes = {},
  availableToAdd,
  onRemove,
  onAdd,
  onNoteChange,
  color = "indigo",
  selectedAgent = null,
  onAgentClick,
  cellHighlighted = false,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bgClass = color === "purple" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-indigo-50 border-indigo-200 text-indigo-700";
  const pillHighlightClass =
    "ring-2 ring-amber-400 border-amber-400 bg-amber-100 shadow-sm text-amber-900";

  return (
    <div
      className={`flex flex-col gap-1 min-h-[3rem] text-right rounded-lg transition-colors ${
        cellHighlighted ? "ring-2 ring-inset ring-amber-300 bg-amber-50/50" : ""
      }`}
      dir="rtl"
    >
      {agents.length === 0 && (
        <div className="flex items-center justify-center gap-1 text-xs text-red-400 py-1">
          <X className="w-3 h-3" /> אין
        </div>
      )}
      <div className="flex flex-col gap-1">
      {agents.map(agent => {
        const pillHighlighted = selectedAgent && agent === selectedAgent;
        return (
        <div
          key={agent}
          className={`w-full px-1.5 py-1 rounded-lg border flex flex-col gap-0.5 ${bgClass} ${
            pillHighlighted ? pillHighlightClass : ""
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-row-reverse">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAgentClick?.(agent);
              }}
              className={`text-xs font-semibold leading-tight break-words min-w-0 flex-1 text-right hover:underline cursor-pointer ${
                pillHighlighted ? "text-amber-900" : ""
              }`}
              title={agent}
            >
              {agent}
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <NotePopover
                note={notes[`${cellKey}|${agent}`]}
                onSave={(val) => onNoteChange(cellKey, agent, val)}
                color={color}
              />
              <button onClick={() => onRemove(agent)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          {notes[`${cellKey}|${agent}`] && (
            <div className="text-xs opacity-70 leading-tight break-words text-right">{notes[`${cellKey}|${agent}`]}</div>
          )}
        </div>
        );
      })}
      </div>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          disabled={availableToAdd.length === 0}
          className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          <span className="text-xs">הוסף</span>
        </button>
        {showDropdown && availableToAdd.length > 0 && (
          <div className="absolute z-50 top-full mt-1 right-0 w-36 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {availableToAdd.map(agent => (
              <button
                key={agent}
                onClick={() => { onAdd(agent); setShowDropdown(false); }}
                className="w-full text-right px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {agent}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AutoScheduleBuilder({ weekStart }) {
  const [assignments, setAssignments] = useState(null); // null = not generated yet
  const [notes, setNotes] = useState({}); // { "cellKey|agentName": "note text" }
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendSmsOnPublish, setSendSmsOnPublish] = useState(true);
  const [lastPublishedRecords, setLastPublishedRecords] = useState([]);
  const [resendingSms, setResendingSms] = useState(false);
  const { toast } = useToast();
  const scheduleGridRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (scheduleGridRef.current && !scheduleGridRef.current.contains(e.target)) {
        setSelectedAgent(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAgentClick = (agent) => {
    setSelectedAgent((prev) => (prev === agent ? null : agent));
  };

  const handleNoteChange = (cellKey, agent, value) => {
    setNotes(prev => {
      const key = `${cellKey}|${agent}`;
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  const queryClient = useQueryClient();

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo = format(weekDays[4], "yyyy-MM-dd");

  const { data: unavailabilities = [] } = useQuery({
    queryKey: ["shift-unavailabilities-builder", dateFrom, dateTo],
    queryFn: async () => {
      const results = await Promise.all(
        weekDays.map(d => dataClient.entities.ShiftUnavailability.filter({ date: format(d, "yyyy-MM-dd") }))
      );
      return results.flat();
    },
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ["vacation-requests-builder", dateFrom, dateTo],
    queryFn: () => dataClient.entities.VacationRequest.filter({ status: "approved" }),
  });

  const weekStartStr = format(weekDays[0], "yyyy-MM-dd");
  const { data: confirmations = [] } = useQuery({
    queryKey: ["confirmations-builder", weekStartStr],
    queryFn: () => dataClient.entities.ConstraintConfirmation.filter({ week_start: weekStartStr }),
  });

  const confirmedAgentNames = new Set(confirmations.map(c => c.agent_name));

  const handleGenerate = () => {
    const result = buildAutoSchedule(weekDays, unavailabilities, vacationRequests, confirmedAgentNames);
    setAssignments(result);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!assignments) return;
    setSaving(true);

    // assignments values are arrays of agent names
    // holiday_eve is saved as "morning" shift_type in DB
    const records = Object.entries(assignments)
      .flatMap(([key, agents]) => {
        const [dateStr, shiftType] = key.split("|");
        const dbShiftType = shiftType === "holiday_eve" ? "morning" : shiftType;
        return (agents || []).map(agent => ({ agent_name: agent, shift_type: dbShiftType, date: dateStr }));
      });

    // Fetch & delete existing registrations for this week
    const allWeekRegs = await Promise.all(
      weekDays.map(d => dataClient.entities.ShiftRegistration.filter({ date: format(d, "yyyy-MM-dd") }))
    ).then(r => r.flat());
    await Promise.all(allWeekRegs.map(r => dataClient.entities.ShiftRegistration.delete(r.id)));

    let savedRecords = [];
    if (records.length > 0) {
      savedRecords = await dataClient.entities.ShiftRegistration.bulkCreate(records);
    }

    await queryClient.invalidateQueries({ queryKey: ["shift-registrations-builder"] });
    await refreshScheduleQueriesAfterPublish(queryClient, {
      dateFrom,
      dateTo,
      records: savedRecords.length ? savedRecords : records,
    });

    setLastPublishedRecords(records);

    if (sendSmsOnPublish) {
      const smsResult = await sendScheduleSmsNotifications({ records, enabled: true });
      toastScheduleSmsResult(toast, smsResult, {
        simulatedTitle: (count) => `SMS דמו: ${count} הודעות`,
        successTitle: (count) => `נשלחו ${count} SMS`,
        emptyTitle: "השיבוץ פורסם · SMS לא נשלח",
      });
    }

    setSaving(false);
    setSaved(true);
  };

  const handleResendSms = async () => {
    if (!lastPublishedRecords.length) return;
    setResendingSms(true);
    try {
      const smsResult = await resendScheduleSmsNotifications(lastPublishedRecords);
      toastScheduleSmsResult(toast, smsResult, {
        simulatedTitle: (count) => `SMS דמו (שליחה חוזרת): ${count}`,
        successTitle: (count) => `נשלחו שוב ${count} SMS`,
        emptyTitle: "SMS לא נשלח",
      });
    } finally {
      setResendingSms(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow shadow-cyan-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">שיבוץ אוטומטי</h3>
            <p className="text-xs text-slate-400">
              שבוע {format(weekDays[0], "dd/MM")} – {format(weekDays[4], "dd/MM/yyyy")}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold shadow hover:shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          {assignments ? "צור מחדש" : "צור שיבוץ"}
        </button>
      </div>

      {!assignments && (
        <div className="text-center py-10 text-slate-400 text-sm">
          לחץ "צור שיבוץ" ליצירת שיבוץ אוטומטי לפי האילוצים שנשלחו
        </div>
      )}

      {assignments && (
        <>
          {/* Preview table */}
          <div ref={scheduleGridRef} className="rounded-2xl border border-slate-100 overflow-x-auto mb-4">
            {/* Header */}
            <div className="grid grid-cols-6 bg-slate-50 border-b border-slate-100">
              <div className="py-2 px-3 text-xs font-semibold text-slate-400">משמרת</div>
              {weekDays.map((date, i) => (
                <div key={i} className="py-2 text-center">
                  <div className="text-xs text-slate-400">{DAYS[i]}</div>
                  <div className="text-xs font-bold text-slate-600">{format(date, "dd/MM")}</div>
                </div>
              ))}
            </div>

            {[
              { type: "morning", label: "בוקר", time: "08:00–16:00", Icon: Sun, color: "text-amber-500" },
              { type: "evening", label: "ערב", time: "09:00–17:00", Icon: Moon, color: "text-indigo-500" },
            ].map(shift => (
              <div key={shift.type} className="grid grid-cols-6 auto-rows-auto items-stretch border-t border-slate-100">
                <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 border-l border-slate-100">
                  <shift.Icon className={`w-4 h-4 ${shift.color}`} />
                  <span className={`text-xs font-bold ${shift.color}`}>{shift.label}</span>
                  <span className="text-xs text-slate-400">{shift.time}</span>
                </div>
                {weekDays.map(date => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const isHolidayEve = HOLIDAY_EVE_DATES.includes(dateStr);

                  // Holiday eve day: show special cell spanning both rows only on morning row
                  if (isHolidayEve && shift.type === "morning") {
                    const cellKey = `${dateStr}|holiday_eve`;
                    const agents = assignments[cellKey] || [];
                    const availableToAdd = agentsAvailableForCell(agents);
                    const cellHighlighted = selectedAgent && agents.includes(selectedAgent);
                    return (
                      <div key={dateStr} className="py-2 px-1 flex flex-col gap-1 bg-purple-50/50 row-span-2 self-stretch">
                        <div className="text-center text-xs font-bold text-purple-600 mb-0.5">ערב חג</div>
                        <div className="text-center text-xs text-purple-400 mb-1">09:00–14:00</div>
                        <ShiftCell
                          cellKey={cellKey}
                          agents={agents}
                          notes={notes}
                          availableToAdd={availableToAdd}
                          color="purple"
                          selectedAgent={selectedAgent}
                          onAgentClick={handleAgentClick}
                          cellHighlighted={cellHighlighted}
                          onRemove={(agent) => setAssignments(prev => ({
                            ...prev,
                            [cellKey]: prev[cellKey].filter(a => a !== agent)
                          }))}
                          onAdd={(agent) => setAssignments(prev => ({
                            ...prev,
                            [cellKey]: [...(prev[cellKey] || []), agent]
                          }))}
                          onNoteChange={handleNoteChange}
                        />
                      </div>
                    );
                  }
                  if (isHolidayEve && shift.type === "evening") {
                    return <div key={dateStr} className="py-3 px-2 bg-purple-50/30" />;
                  }

                  const cellKey = `${dateStr}|${shift.type}`;
                  const agents = assignments[cellKey] || [];
                  const availableToAdd = agentsAvailableForCell(agents);
                  const cellHighlighted = selectedAgent && agents.includes(selectedAgent);
                  return (
                    <div key={dateStr} className="py-2 px-1 self-stretch">
                    <ShiftCell
                      cellKey={cellKey}
                      agents={agents}
                      notes={notes}
                      availableToAdd={availableToAdd}
                      selectedAgent={selectedAgent}
                      onAgentClick={handleAgentClick}
                      cellHighlighted={cellHighlighted}
                      onRemove={(agent) => setAssignments(prev => ({
                        ...prev,
                        [cellKey]: prev[cellKey].filter(a => a !== agent)
                      }))}
                      onAdd={(agent) => setAssignments(prev => ({
                        ...prev,
                        [cellKey]: [...(prev[cellKey] || []), agent]
                      }))}
                      onNoteChange={handleNoteChange}
                    />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 mb-3 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={sendSmsOnPublish}
              onChange={(e) => setSendSmsOnPublish(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>
              שלח SMS לנציגים בפרסום
              {demoModeEnabled && (
                <span className="text-cyan-600 font-semibold"> (דמו — ללא שליחה אמיתית)</span>
              )}
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving || resendingSms}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> שומר...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> ✓ פורסם בהצלחה!</>
              ) : (
                "אשר ופרסם שיבוץ"
              )}
            </button>
            {saved && lastPublishedRecords.length > 0 && (
              <button
                type="button"
                onClick={handleResendSms}
                disabled={saving || resendingSms}
                className="w-full py-2 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm font-semibold hover:bg-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resendingSms ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> שולח SMS...</>
                ) : (
                  <><MessageSquare className="w-4 h-4" /> שלח שוב SMS לנציגים (ללא שינוי שיבוץ)</>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}