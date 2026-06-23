import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import courseConfig from "@/data/trainingCourseConfig.json";
import courseTemplate from "@/data/trainingCourseTemplate.json";
import { demoModeEnabled } from "@/api/demoClient";
import { dataClient } from "@/api/client";
import { isSupabaseBackend } from "@/api/dataClient";

export const TRAINING_SCHEDULE_STORAGE_KEY = "smart-break-shift-training-schedule-v1";
export const TRAINING_SCHEDULE_CHANGE_EVENT = "training-schedule-changed";

const CLOUD_ROW_ID = "default";
const TEMPLATE_SESSION_IDS = new Set(courseTemplate.sessions.map((session) => session.id));

let memoryStore = null;
let hydratePromise = null;

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

function normalizeStore(parsed) {
  if (!parsed || parsed.version !== 1) return emptyStore();
  return {
    version: 1,
    configOverrides: parsed.configOverrides || {},
    sessionPatches: parsed.sessionPatches || {},
    addedSessions: Array.isArray(parsed.addedSessions) ? parsed.addedSessions : [],
    deletedSessionIds: Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [],
  };
}

function readLocalStorageRaw() {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(TRAINING_SCHEDULE_STORAGE_KEY);
    if (raw) return normalizeStore(JSON.parse(raw));
  } catch {
    // ignore
  }
  return emptyStore();
}

function readRaw() {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalStorageRaw();
  return memoryStore;
}

function writeRaw(store) {
  memoryStore = normalizeStore(store);
  memoryStore.updatedAt = new Date().toISOString();
  if (typeof window !== "undefined") {
    localStorage.setItem(TRAINING_SCHEDULE_STORAGE_KEY, JSON.stringify(memoryStore));
    window.dispatchEvent(new CustomEvent(TRAINING_SCHEDULE_CHANGE_EVENT));
  }
  persistScheduleToCloud(memoryStore).catch((err) => {
    console.warn("[trainingScheduleStore] cloud persist failed", err);
  });
}

async function persistScheduleToCloud(store) {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.TrainingScheduleSettings) {
    return;
  }

  const payload = {
    id: CLOUD_ROW_ID,
    payload: normalizeStore(store),
    updated_at: new Date().toISOString(),
  };

  const existing = await dataClient.entities.TrainingScheduleSettings.filter({ id: CLOUD_ROW_ID });
  if (existing?.length) {
    await dataClient.entities.TrainingScheduleSettings.update(existing[0].id, payload);
  } else {
    await dataClient.entities.TrainingScheduleSettings.create(payload);
  }
}

function storeHasOverrides(store) {
  const s = normalizeStore(store);
  return (
    Object.keys(s.configOverrides).length > 0 ||
    Object.keys(s.sessionPatches).length > 0 ||
    s.addedSessions.length > 0 ||
    s.deletedSessionIds.length > 0
  );
}

async function loadScheduleFromCloud() {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.TrainingScheduleSettings) {
    memoryStore = readLocalStorageRaw();
    return memoryStore;
  }

  const local = readLocalStorageRaw();

  try {
    const rows = await dataClient.entities.TrainingScheduleSettings.filter({ id: CLOUD_ROW_ID });
    const row = rows?.[0];
    const cloudStore = row?.payload ? normalizeStore(row.payload) : null;
    const localHas = storeHasOverrides(local);
    const cloudHas = cloudStore && storeHasOverrides(cloudStore);

    if (localHas && cloudHas) {
      const localUpdated = Date.parse(local.updatedAt || 0);
      const cloudUpdated = Date.parse(row.updated_at || cloudStore.updatedAt || 0);
      if (localUpdated >= cloudUpdated) {
        memoryStore = local;
        await persistScheduleToCloud(local);
        return memoryStore;
      }
      memoryStore = cloudStore;
      if (typeof window !== "undefined") {
        localStorage.setItem(TRAINING_SCHEDULE_STORAGE_KEY, JSON.stringify(memoryStore));
      }
      return memoryStore;
    }

    if (cloudHas) {
      memoryStore = cloudStore;
      if (typeof window !== "undefined") {
        localStorage.setItem(TRAINING_SCHEDULE_STORAGE_KEY, JSON.stringify(memoryStore));
      }
      return memoryStore;
    }

    if (localHas) {
      memoryStore = local;
      await persistScheduleToCloud(local);
      return memoryStore;
    }

    if (row?.payload) {
      memoryStore = normalizeStore(row.payload);
      if (typeof window !== "undefined") {
        localStorage.setItem(TRAINING_SCHEDULE_STORAGE_KEY, JSON.stringify(memoryStore));
      }
      return memoryStore;
    }
  } catch (err) {
    console.warn("[trainingScheduleStore] cloud load failed", err);
  }

  memoryStore = local;
  return memoryStore;
}

/** טוען לוח הדרכה מ-Supabase (כל הנציגים / רשת חיצונית) */
export function hydrateTrainingScheduleStore() {
  if (!hydratePromise) {
    hydratePromise = loadScheduleFromCloud().finally(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TRAINING_SCHEDULE_CHANGE_EVENT));
      }
    });
  }
  return hydratePromise;
}

/** רענון מ-Supabase Realtime */
export function invalidateTrainingScheduleCache() {
  memoryStore = null;
  hydratePromise = null;
  return hydrateTrainingScheduleStore();
}

export function subscribeTrainingScheduleStore(callback) {
  const onStorage = (e) => {
    if (e.key === TRAINING_SCHEDULE_STORAGE_KEY) {
      memoryStore = null;
      callback();
    }
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

function shiftIsoDate(isoDate, deltaDays) {
  if (!isoDate || !Number.isFinite(deltaDays)) return isoDate;
  const date = parseISO(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const shifted = addDays(date, deltaDays);
  if (Number.isNaN(shifted.getTime())) return isoDate;
  return format(shifted, "yyyy-MM-dd");
}

/** Template sessions get dates from resolveTrainingScheduleBase — drop stale date overrides. */
function clearTemplateSessionDateOverrides(store) {
  for (const sessionId of TEMPLATE_SESSION_IDS) {
    const patch = store.sessionPatches[sessionId];
    if (!patch || patch.date == null) continue;

    const { date: _date, ...rest } = patch;
    const meaningfulKeys = Object.keys(rest).filter((key) => key !== "updatedAt");
    if (meaningfulKeys.length === 0) {
      delete store.sessionPatches[sessionId];
    } else {
      store.sessionPatches[sessionId] = {
        ...rest,
        updatedAt: new Date().toISOString(),
      };
    }
  }
}

/** When course start moves, shift patched/custom session dates by the same delta. */
function shiftSessionDatesForCourseStartChange(store, deltaDays) {
  if (!deltaDays) return;

  for (const [sessionId, patch] of Object.entries(store.sessionPatches)) {
    if (!patch?.date) continue;
    store.sessionPatches[sessionId] = {
      ...patch,
      date: shiftIsoDate(patch.date, deltaDays),
      updatedAt: new Date().toISOString(),
    };
  }

  store.addedSessions = store.addedSessions.map((session) => {
    if (!session?.date) return session;
    return {
      ...session,
      date: shiftIsoDate(session.date, deltaDays),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function updateTrainingCourseConfig(patch) {
  const store = readRaw();
  const currentConfig = { ...courseConfig, ...store.configOverrides };

  let courseStartDelta = 0;
  if (patch.courseStartDate !== undefined) {
    const newStart = String(patch.courseStartDate ?? "").trim();
    const oldStart = currentConfig.courseStartDate;
    if (newStart && oldStart && newStart !== oldStart) {
      courseStartDelta = differenceInCalendarDays(
        parseISO(`${newStart}T12:00:00`),
        parseISO(`${oldStart}T12:00:00`)
      );
    }
  }

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

  if (patch.courseStartDate !== undefined) {
    clearTemplateSessionDateOverrides(store);
    if (courseStartDelta !== 0) {
      shiftSessionDatesForCourseStartChange(store, courseStartDelta);
    }
  }

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

/** Apply overrides onto a resolved base schedule. */
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

/** טוען לוח + מטא-דאטה למצגות */
export async function hydrateTrainingData() {
  const { hydrateTrainingPresentationMeta } = await import("@/lib/trainingPresentations");
  await Promise.all([hydrateTrainingScheduleStore(), hydrateTrainingPresentationMeta()]);
}
