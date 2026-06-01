import courseConfig from "@/data/trainingCourseConfig.json";

export const TRAINING_SCHEDULE_STORAGE_KEY = "smart-break-shift-training-schedule-v1";
export const TRAINING_SCHEDULE_CHANGE_EVENT = "training-schedule-changed";

function makeSessionId() {
  return `custom_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function emptyStore() {
  return {
    version: 1,
    configOverrides: {},
    sessionPatches: {},
    addedSessions: [],
    deletedSessionIds: [],
  };
}

function readRaw() {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(TRAINING_SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) {
        return {
          version: 1,
          configOverrides: parsed.configOverrides || {},
          sessionPatches: parsed.sessionPatches || {},
          addedSessions: Array.isArray(parsed.addedSessions) ? parsed.addedSessions : [],
          deletedSessionIds: Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [],
        };
      }
    }
  } catch {
    // ignore
  }
  return emptyStore();
}

function writeRaw(store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRAINING_SCHEDULE_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(TRAINING_SCHEDULE_CHANGE_EVENT));
}

export function subscribeTrainingScheduleStore(callback) {
  const onStorage = (e) => {
    if (e.key === TRAINING_SCHEDULE_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(TRAINING_SCHEDULE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(TRAINING_SCHEDULE_CHANGE_EVENT, callback);
  };
}

export function getTrainingScheduleOverrides() {
  return readRaw();
}

export function getTrainingConfigOverrides() {
  return readRaw().configOverrides;
}

function normalizePatch(patch) {
  const out = {};
  if (patch.date != null) out.date = String(patch.date).trim();
  if (patch.startTime != null) out.startTime = String(patch.startTime).trim();
  if (patch.endTime != null) out.endTime = String(patch.endTime).trim();
  if (patch.title != null) out.title = String(patch.title).trim();
  if (patch.description != null) out.description = String(patch.description).trim();
  if (patch.isBreak != null) out.isBreak = Boolean(patch.isBreak);
  return out;
}

export function patchTrainingSession(sessionId, patch) {
  if (!sessionId) throw new Error("missing_session_id");
  const store = readRaw();
  const normalized = normalizePatch(patch);
  if (Object.keys(normalized).length === 0) return;
  store.sessionPatches[sessionId] = {
    ...(store.sessionPatches[sessionId] || {}),
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  writeRaw(store);
}

export function upsertTrainingSession({
  id,
  title,
  date,
  startTime,
  endTime,
  description = "",
  isBreak = false,
}) {
  const trimmedTitle = String(title || "").trim();
  const trimmedDate = String(date || "").trim();
  const trimmedStart = String(startTime || "").trim();
  const trimmedEnd = String(endTime || "").trim();
  if (!trimmedTitle || !trimmedDate || !trimmedStart || !trimmedEnd) {
    throw new Error("session_fields_required");
  }

  const payload = {
    title: trimmedTitle,
    date: trimmedDate,
    startTime: trimmedStart,
    endTime: trimmedEnd,
    description: String(description || "").trim(),
    isBreak: Boolean(isBreak),
  };

  const store = readRaw();

  if (id) {
    const addedIdx = store.addedSessions.findIndex((s) => s.id === id);
    if (addedIdx >= 0) {
      store.addedSessions[addedIdx] = {
        ...store.addedSessions[addedIdx],
        ...payload,
        id,
        updatedAt: new Date().toISOString(),
      };
      writeRaw(store);
      return id;
    }
    store.sessionPatches[id] = {
      ...(store.sessionPatches[id] || {}),
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    writeRaw(store);
    return id;
  }

  const sessionId = makeSessionId();
  store.addedSessions.push({
    id: sessionId,
    ...payload,
    createdAt: new Date().toISOString(),
  });
  writeRaw(store);
  return sessionId;
}

export function deleteTrainingSession(sessionId) {
  if (!sessionId) throw new Error("missing_session_id");
  const store = readRaw();
  const addedIdx = store.addedSessions.findIndex((s) => s.id === sessionId);
  if (addedIdx >= 0) {
    store.addedSessions.splice(addedIdx, 1);
  } else {
    if (!store.deletedSessionIds.includes(sessionId)) {
      store.deletedSessionIds.push(sessionId);
    }
    delete store.sessionPatches[sessionId];
  }
  writeRaw(store);
}

export function updateTrainingCourseConfig(patch) {
  const store = readRaw();
  const allowed = ["title", "description", "courseStartDate", "templateStartDate"];
  const next = { ...store.configOverrides };
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      const val = String(patch[key] ?? "").trim();
      if (val) next[key] = val;
      else delete next[key];
    }
  }
  store.configOverrides = next;
  writeRaw(store);
}

export function resetTrainingScheduleStore() {
  writeRaw(emptyStore());
}

export function mergeSessionFields(session, patch) {
  const next = { ...session, ...patch };
  const start = next.startTime || session.startTime;
  const end = next.endTime || session.endTime;
  next.timeLabel = `${start}–${end}`;
  return next;
}

/** Apply localStorage overrides onto a resolved base schedule. */
export function applyScheduleCustomizations(baseSchedule) {
  const store = readRaw();
  const deleted = new Set(store.deletedSessionIds);

  let sessions = baseSchedule.sessions
    .filter((s) => !deleted.has(s.id))
    .map((s) => {
      const patch = store.sessionPatches[s.id];
      return patch ? mergeSessionFields(s, patch) : s;
    });

  for (const added of store.addedSessions) {
    if (deleted.has(added.id)) continue;
    const patch = store.sessionPatches[added.id];
    const merged = mergeSessionFields(
      {
        id: added.id,
        date: added.date,
        dayOffset: null,
        startTime: added.startTime,
        endTime: added.endTime,
        timeLabel: `${added.startTime}–${added.endTime}`,
        title: added.title,
        description: added.description || "",
        isBreak: Boolean(added.isBreak),
        order: 0,
      },
      patch || {}
    );
    if (!sessions.some((s) => s.id === merged.id)) {
      sessions.push(merged);
    }
  }

  sessions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  sessions = sessions.map((s, index) => ({ ...s, order: index + 1 }));

  const HEBREW_WEEKDAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const dayMap = new Map();
  for (const session of sessions) {
    if (!dayMap.has(session.date)) {
      const dateObj = new Date(`${session.date}T12:00:00`);
      dayMap.set(session.date, {
        date: session.date,
        weekdayLabel: HEBREW_WEEKDAY[dateObj.getDay()],
        displayDate: dateObj.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }),
        sessions: [],
      });
    }
    dayMap.get(session.date).sessions.push(session);
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = days[0]?.date ?? baseSchedule.courseStartDate;
  const lastDate = days[days.length - 1]?.date ?? baseSchedule.courseStartDate;

  const formatDisplay = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${Number(d)}.${Number(m)}.${y}`;
  };

  return {
    ...baseSchedule,
    days,
    sessions,
    dateRangeLabel: `${formatDisplay(firstDate)} – ${formatDisplay(lastDate)}`,
  };
}

export function getEffectiveCourseConfig() {
  const overrides = getTrainingConfigOverrides();
  return { ...courseConfig, ...overrides };
}
