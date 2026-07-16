import { APP_CONFIG, STORAGE_KEYS } from '../config.js';
import { replaceCourses, getCourses } from '../data/courses.js';
import { replaceRestaurants } from '../data/restaurants.js';
import { state, dispatchRender, dispatchToast } from '../state.js';
import { createId, normalizeNickname } from '../utils.js';
import {
  getActiveCourse, getPendingCompletions, getRecords, getUser, readStored, saveActiveCourse,
  savePendingCompletions, saveRecords, saveUser, updateActiveCourse, writeStored
} from '../storage.js';
import { flushEventQueue } from './events.js';

export async function probeDjangoBackend() {
  if (!APP_CONFIG.DJANGO_API_URL || location.protocol === 'file:') return false;
  try {
    const response = await fetch(`${APP_CONFIG.DJANGO_API_URL.replace(/\/$/, '')}/health/`, { credentials:'include', headers:{Accept:'application/json'} });
    const result = await response.json();
    state.backendAvailable = response.ok && result?.ok === true;
  } catch (error) { state.backendAvailable = false; }
  return state.backendAvailable;
}

function apiUrl(path) { return `${APP_CONFIG.DJANGO_API_URL.replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`; }

export async function djangoRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { Accept:'application/json', ...(options.headers || {}) };
  const request = { method, headers, credentials:'include' };
  if (!['GET','HEAD','OPTIONS'].includes(method) && state.csrfToken) headers['X-CSRFToken'] = state.csrfToken;
  if (Object.prototype.hasOwnProperty.call(options, 'body')) {
    headers['Content-Type'] = 'application/json;charset=utf-8';
    request.body = JSON.stringify(options.body ?? {});
  }
  let response;
  try { response = await fetch(apiUrl(path), request); }
  catch (error) { state.backendAvailable = false; throw error; }
  const text = response.status === 204 ? '' : await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (error) { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.message || '백엔드 요청을 처리하지 못했습니다.');
    error.status = response.status; error.code = payload?.code || 'REQUEST_FAILED'; throw error;
  }
  return payload;
}

function applyBackendDatasets(payload) {
  if (Array.isArray(payload?.courses)) replaceCourses(payload.courses);
  if (Array.isArray(payload?.restaurants)) replaceRestaurants(payload.restaurants);
  if (!getCourses().some(course => course.id === state.selectedCourseId)) state.selectedCourseId = getCourses()[0].id;
}

function localUserFromBackend(serverUser, fallback = {}) {
  return { id:String(serverUser.anonymousId || serverUser.id || fallback.id || createId('anon')), nickname:normalizeNickname(serverUser.nickname || fallback.nickname || ''), createdAt:serverUser.createdAt || fallback.createdAt || new Date().toISOString(), lastVisitedAt:serverUser.lastVisitedAt || fallback.lastVisitedAt || new Date().toISOString() };
}

function localActivityFromBackend(server, existing) {
  const local = existing?.courseId === server.courseId ? existing : null;
  return { id:local?.id || `activity_${server.id}`, backendActivityId:String(server.id), courseId:server.courseId, startedAt:server.startedAt || local?.startedAt || new Date().toISOString(), startVerified:server.startVerified === true, finishVerified:server.finishVerified === true, photoVerified:server.photoVerified === true, photoName:local?.photoName || '', startLocation:local?.startLocation || null, finishLocation:local?.finishLocation || null, photoMeta:local?.photoMeta || null, currentStep:server.currentStep || 'start' };
}

export async function syncNicknameWithBackend(nickname) {
  if (!state.backendAvailable) return null;
  const result = await djangoRequest(state.backendProfile ? 'me/' : 'session/', { method:state.backendProfile ? 'PATCH' : 'POST', body:{ nickname } });
  if (!result?.user) return null;
  state.backendProfile = result.user;
  const user = localUserFromBackend(result.user, getUser() || {});
  if (user.nickname.length >= 2) saveUser(user);
  return user;
}

export async function syncStartedActivity(localActivityId, courseId, replaceExisting = false) {
  if (!state.backendAvailable) return getActiveCourse();
  const task = (async () => {
    if (!state.backendProfile && getUser()) await syncNicknameWithBackend(getUser().nickname);
    let result;
    try { result = await djangoRequest('activities/', { method:'POST', body:{ courseId } }); }
    catch (error) {
      if (error.code !== 'ACTIVE_ACTIVITY_EXISTS') throw error;
      const current = (await djangoRequest('activities/active/'))?.activity;
      if (current?.courseId === courseId) result = { activity:current };
      else if (replaceExisting && current) {
        await djangoRequest(`activities/${encodeURIComponent(current.id)}/`, { method:'DELETE' });
        result = await djangoRequest('activities/', { method:'POST', body:{ courseId } });
      } else throw error;
    }
    const local = getActiveCourse();
    if (result?.activity && local?.id === localActivityId) {
      const merged = localActivityFromBackend(result.activity, local); saveActiveCourse(merged); return merged;
    }
    return local;
  })();
  state.activitySyncPromise = task;
  try { return await task; } finally { if (state.activitySyncPromise === task) state.activitySyncPromise = null; }
}

export async function ensureBackendActivity(active) {
  if (!state.backendAvailable || !active || active.backendActivityId) return active;
  return syncStartedActivity(active.id, active.courseId, false);
}

export async function stopBackendActivity(active) {
  if (!state.backendAvailable || !active) return;
  let id = active.backendActivityId;
  if (!id) id = (await djangoRequest('activities/active/'))?.activity?.id;
  if (id) await djangoRequest(`activities/${encodeURIComponent(id)}/`, { method:'DELETE' });
}

export async function verifyBackendLocation(active, target, location) {
  const synced = await ensureBackendActivity(active);
  if (!state.backendAvailable || !synced?.backendActivityId) return null;
  return djangoRequest(`activities/${encodeURIComponent(synced.backendActivityId)}/verify-location/`, { method:'POST', body:{ ...location, target } });
}

export async function verifyBackendPhoto(active, photoMeta) {
  const synced = await ensureBackendActivity(active);
  if (!state.backendAvailable || !synced?.backendActivityId) return null;
  return djangoRequest(`activities/${encodeURIComponent(synced.backendActivityId)}/verify-photo/`, { method:'POST', body:photoMeta });
}

export async function completeBackendActivity(active) {
  const synced = await ensureBackendActivity(active);
  if (!state.backendAvailable || !synced?.backendActivityId) return null;
  return djangoRequest(`activities/${encodeURIComponent(synced.backendActivityId)}/complete/`, { method:'POST', body:{} });
}

export async function syncPendingCompletions() {
  if (!state.backendAvailable) return;
  const pending = getPendingCompletions();
  const remaining = [];
  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    try {
      const local = item.activity;
      let server = local.backendActivityId ? (await djangoRequest(`activities/${encodeURIComponent(local.backendActivityId)}/`))?.activity : null;
      if (!server) server = (await djangoRequest('activities/', { method:'POST', body:{ courseId:local.courseId } }))?.activity;
      if (!server) throw new Error('missing-server-activity');
      const base = `activities/${encodeURIComponent(server.id)}/`;
      if (local.startVerified && local.startLocation && !server.startVerified) server = (await djangoRequest(`${base}verify-location/`, { method:'POST', body:{ ...local.startLocation, target:'start' } }))?.activity || server;
      if (local.photoVerified && local.photoMeta && !server.photoVerified) server = (await djangoRequest(`${base}verify-photo/`, { method:'POST', body:local.photoMeta }))?.activity || server;
      if (local.finishVerified && local.finishLocation && !server.finishVerified) server = (await djangoRequest(`${base}verify-location/`, { method:'POST', body:{ ...local.finishLocation, target:'finish' } }))?.activity || server;
      if (!(server.startVerified && server.photoVerified && server.finishVerified)) throw new Error('pending-verification');
      const completed = await djangoRequest(`${base}complete/`, { method:'POST', body:{} });
      const record = completed?.completion || completed?.record;
      if (!record) throw new Error('missing-completion');
      saveRecords([record, ...getRecords().filter(existing => existing.id !== item.localRecordId && existing.id !== record.id)]);
      if (readStored(STORAGE_KEYS.LAST_RECORD, '') === item.localRecordId) writeStored(STORAGE_KEYS.LAST_RECORD, record.id);
    } catch (error) {
      savePendingCompletions([...remaining, ...pending.slice(index)]);
      throw error;
    }
  }
  savePendingCompletions(remaining);
}

export function reportBackendSyncFailure(error, message = '백엔드 연결이 끊겨 브라우저에만 저장했습니다.') {
  if (!error?.status) state.backendAvailable = false;
  dispatchToast(error?.status ? (error.message || '백엔드에서 요청을 처리하지 못했습니다.') : message);
}

export async function syncDjangoBootstrap() {
  const payload = await djangoRequest('bootstrap/');
  if (!payload?.ok) throw new Error('invalid-bootstrap');
  state.backendAvailable = true; state.csrfToken = String(payload.csrfToken || ''); applyBackendDatasets(payload);
  let user = getUser();
  if (payload.user) {
    state.backendProfile = payload.user;
    user = user?.nickname !== payload.user.nickname ? await syncNicknameWithBackend(user?.nickname || payload.user.nickname) : localUserFromBackend(payload.user, user || {});
    if (user?.nickname?.length >= 2) saveUser(user);
  } else if (user) await syncNicknameWithBackend(user.nickname);
  await syncPendingCompletions();
  if (Array.isArray(payload.completions)) saveRecords([...payload.completions, ...getRecords()]);
  const serverActive = (await djangoRequest('activities/active/'))?.activity;
  if (serverActive) saveActiveCourse(localActivityFromBackend(serverActive, getActiveCourse()));
  state.lastRecord = getLastRecord();
  flushEventQueue(); dispatchRender(); return true;
}

export function getLastRecord() {
  const id = readStored(STORAGE_KEYS.LAST_RECORD, '');
  return getRecords().find(record => record.id === id) || getRecords()[0] || null;
}
