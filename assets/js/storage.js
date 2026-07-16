import { STORAGE_KEYS } from './config.js';
import { courseById, getCourses } from './data/courses.js';
import { createId, normalizeNickname } from './utils.js';
import { dispatchToast } from './state.js';

export function safeParse(rawValue, fallback) {
  if (!rawValue) return fallback;
  try { return JSON.parse(rawValue); }
  catch (error) { return fallback; }
}

export function readStored(key, fallback) {
  try { return safeParse(localStorage.getItem(key), fallback); }
  catch (error) { return fallback; }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    dispatchToast('브라우저 저장 공간을 사용할 수 없습니다. 저장 설정을 확인해 주세요.');
    return false;
  }
}

export function removeStored(key) {
  try { localStorage.removeItem(key); } catch (error) { /* 저장소가 막혀도 화면은 계속 사용합니다. */ }
}

export function getUser() {
  const value = readStored(STORAGE_KEYS.USER, null);
  if (!value || typeof value !== 'object' || typeof value.nickname !== 'string' || !value.nickname.trim()) return null;
  const validId = typeof value.id === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(value.id);
  const normalized = {
    id:validId ? value.id : createId('anon'),
    nickname:normalizeNickname(value.nickname),
    createdAt:value.createdAt || new Date().toISOString(),
    lastVisitedAt:value.lastVisitedAt || new Date().toISOString()
  };
  if (normalized.nickname.length < 2) return null;
  if (JSON.stringify(normalized) !== JSON.stringify(value)) writeStored(STORAGE_KEYS.USER, normalized);
  return normalized;
}

export function saveUser(user) { return writeStored(STORAGE_KEYS.USER, user); }

export function getActiveCourse() {
  const value = readStored(STORAGE_KEYS.ACTIVE, null);
  if (!value || !value.courseId || !courseById(value.courseId)) return null;
  const parsedStart = new Date(value.startedAt);
  const normalized = {
    id:String(value.id || createId('activity')),
    backendActivityId:typeof value.backendActivityId === 'string' ? value.backendActivityId : '',
    courseId:value.courseId,
    startedAt:Number.isNaN(parsedStart.getTime()) ? new Date().toISOString() : parsedStart.toISOString(),
    startVerified:value.startVerified === true,
    finishVerified:value.finishVerified === true,
    photoVerified:value.photoVerified === true,
    photoName:typeof value.photoName === 'string' ? value.photoName : '',
    startLocation:validLocation(value.startLocation) ? { ...value.startLocation } : null,
    finishLocation:validLocation(value.finishLocation) ? { ...value.finishLocation } : null,
    photoMeta:value.photoMeta && String(value.photoMeta.fileType || '').startsWith('image/') && Number(value.photoMeta.fileSize) > 0
      ? { requestId:String(value.photoMeta.requestId || createId('verify')), fileType:String(value.photoMeta.fileType), fileSize:Number(value.photoMeta.fileSize) }
      : null,
    currentStep:value.startVerified === true ? (value.photoVerified === true ? (value.finishVerified === true ? 'complete' : 'finish') : 'photo') : 'start'
  };
  if (JSON.stringify(normalized) !== JSON.stringify(value)) writeStored(STORAGE_KEYS.ACTIVE, normalized);
  return normalized;
}

function validLocation(value) {
  return value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude));
}

export function saveActiveCourse(value) {
  if (!value) removeStored(STORAGE_KEYS.ACTIVE);
  else writeStored(STORAGE_KEYS.ACTIVE, value);
}

export function updateActiveCourse(changes) {
  const active = getActiveCourse();
  if (!active) return null;
  const next = { ...active, ...changes };
  next.currentStep = next.startVerified ? (next.photoVerified ? (next.finishVerified ? 'complete' : 'finish') : 'photo') : 'start';
  saveActiveCourse(next);
  return next;
}

export function getRecords() {
  const value = readStored(STORAGE_KEYS.RECORDS, []);
  if (!Array.isArray(value)) return [];
  return value.reduce((records, item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.courseId !== 'string') return records;
    const course = courseById(item.courseId);
    const distance = Number(item.distance);
    const durationMs = Number(item.durationMs);
    const completedAt = new Date(item.completedAt);
    const startedAt = new Date(item.startedAt);
    if (!course || !Number.isFinite(distance) || distance < 0 || !Number.isFinite(durationMs) || durationMs < 0 || Number.isNaN(completedAt.getTime())) return records;
    if (item.startVerified !== true || item.finishVerified !== true || item.photoVerified !== true) return records;
    records.push({
      id:item.id, activityId:typeof item.activityId === 'string' ? item.activityId : '', courseId:course.id,
      courseName:typeof item.courseName === 'string' && item.courseName ? item.courseName.slice(0, 120) : course.name,
      distance, durationMs,
      startedAt:Number.isNaN(startedAt.getTime()) ? completedAt.toISOString() : startedAt.toISOString(),
      completedAt:completedAt.toISOString(), startVerified:true, finishVerified:true, photoVerified:true
    });
    return records;
  }, []);
}

export function saveRecords(records) {
  const ids = new Set();
  writeStored(STORAGE_KEYS.RECORDS, records.filter(record => {
    if (!record || !record.id || ids.has(record.id)) return false;
    ids.add(record.id); return true;
  }).slice(0, 100));
}

export function getPendingCompletions() {
  const value = readStored(STORAGE_KEYS.PENDING_COMPLETIONS, []);
  return Array.isArray(value) ? value.filter(item => item && typeof item.localRecordId === 'string' && item.activity?.courseId) : [];
}
export function savePendingCompletions(items) { writeStored(STORAGE_KEYS.PENDING_COMPLETIONS, items.slice(-20)); }
export function getEvents() { const value = readStored(STORAGE_KEYS.EVENTS, []); return Array.isArray(value) ? value.filter(item => item?.requestId && item?.eventType) : []; }
export function saveEvents(items) { writeStored(STORAGE_KEYS.EVENTS, items.slice(-500)); }
export function getSyncQueue() { const value = readStored(STORAGE_KEYS.QUEUE, []); return Array.isArray(value) ? value.filter(item => item?.requestId && item?.eventType) : []; }
export function saveSyncQueue(items) { writeStored(STORAGE_KEYS.QUEUE, items.slice(-200)); }

export function getPreferences() {
  const value = readStored(STORAGE_KEYS.PREFERENCES, {});
  return {
    largeText:value.largeText === true,
    reduceMotion:value.reduceMotion === true,
    background:['제주 바다','귤밭','오름','돌담길'].includes(value.background) ? value.background : '제주 바다'
  };
}

export function savePreferences(value) { writeStored(STORAGE_KEYS.PREFERENCES, { ...getPreferences(), ...value }); }

export function repairStoredData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value != null) JSON.parse(value);
    } catch (error) { removeStored(key); }
  });
}

export function migrateLegacyV3() {
  if (getUser() || getRecords().length) return false;
  const legacy = readStored('hondigil_mvp_v3', null);
  if (!legacy || typeof legacy !== 'object') return false;
  const nickname = normalizeNickname(legacy.nickname || legacy.user?.nickname || '제주 여행자');
  saveUser({ id:createId('anon'), nickname:nickname.length >= 2 ? nickname : '제주 여행자', createdAt:new Date().toISOString(), lastVisitedAt:new Date().toISOString() });
  const completions = Array.isArray(legacy.completions) ? legacy.completions : [];
  const records = completions.map((item, index) => {
    const course = courseById(item.courseId || item.id) || getCourses()[index % getCourses().length];
    const completedAt = item.date || item.completedAt || new Date().toISOString();
    return { id:String(item.id || createId('record')), activityId:'', courseId:course.id, courseName:item.name || course.name,
      distance:Number(item.distance || course.distance), durationMs:Number(item.durationMs || item.elapsed * 1000 || course.durationMin * 60000),
      startedAt:item.startedAt || completedAt, completedAt, startVerified:true, finishVerified:true, photoVerified:true };
  });
  if (records.length) saveRecords(records);
  savePreferences({
    largeText:legacy.textSize === 'large', reduceMotion:legacy.reduceMotion === true,
    background:legacy.background || '제주 바다'
  });
  return true;
}

export function resetAllData() {
  Object.values(STORAGE_KEYS).forEach(removeStored);
  removeStored('hondigil_mvp_v3');
}
