import { ALLOWED_EVENT_TYPES, APP_CONFIG, STORAGE_KEYS } from '../config.js';
import { state } from '../state.js';
import { createId, localDateKey } from '../utils.js';
import { getSyncQueue, readStored, saveEvents, saveSyncQueue, writeStored } from '../storage.js';

export function createEmptyMetrics() {
  return { visits:0, uniqueUsers:[], courseViews:{}, courseStarts:{}, courseCompletions:{}, restaurantClicks:{}, directionClicks:{}, daily:{}, updatedAt:'' };
}

export function applyEventToMetrics(metrics, event) {
  const next = { ...createEmptyMetrics(), ...metrics };
  next.uniqueUsers = Array.isArray(next.uniqueUsers) ? next.uniqueUsers : [];
  ['courseViews','courseStarts','courseCompletions','restaurantClicks','directionClicks','daily'].forEach(key => { next[key] = { ...(next[key] || {}) }; });
  const data = event.data || {};
  const day = localDateKey(event.createdAt) || localDateKey(new Date());
  next.daily[day] = { ...(next.daily[day] || { visits:0, starts:0, completes:0 }) };
  if (event.eventType === 'user_visited') {
    next.visits += 1; next.daily[day].visits += 1;
    if (event.userId && !next.uniqueUsers.includes(event.userId)) next.uniqueUsers.push(event.userId);
  }
  const bump = (key, id) => { if (id) next[key][id] = Number(next[key][id] || 0) + 1; };
  if (event.eventType === 'course_viewed') bump('courseViews', data.courseId);
  if (event.eventType === 'course_started') { bump('courseStarts', data.courseId); next.daily[day].starts += 1; }
  if (event.eventType === 'course_completed') { bump('courseCompletions', data.courseId); next.daily[day].completes += 1; }
  if (event.eventType === 'restaurant_clicked') bump('restaurantClicks', data.restaurantId);
  if (event.eventType === 'directions_clicked') bump('directionClicks', `${data.map || 'map'}:${data.restaurantId || ''}`);
  next.uniqueUsers = next.uniqueUsers.slice(-500);
  next.updatedAt = event.createdAt;
  return next;
}

export function getMetricsRollup() {
  const value = readStored(STORAGE_KEYS.METRICS, createEmptyMetrics());
  return value && typeof value === 'object' ? { ...createEmptyMetrics(), ...value } : createEmptyMetrics();
}

export function logEvent(eventType, data = {}) {
  if (!ALLOWED_EVENT_TYPES.has(eventType)) return null;
  const event = { requestId:createId('event'), eventType, userId:data.userId || '', createdAt:new Date().toISOString(), data:{ ...data } };
  saveEvents([event, ...readStored(STORAGE_KEYS.EVENTS, [])]);
  writeStored(STORAGE_KEYS.METRICS, applyEventToMetrics(getMetricsRollup(), event));
  if (APP_CONFIG.DATA_SYNC_ENABLED) {
    saveSyncQueue([...getSyncQueue(), event]);
    flushEventQueue();
  }
  return event;
}

export function flushEventQueue() {
  if (state.syncInFlight) return state.syncInFlight;
  state.syncInFlight = flushEventQueueInternal().catch(() => undefined).finally(() => { state.syncInFlight = null; });
  return state.syncInFlight;
}

async function flushEventQueueInternal() {
  const endpoint = state.backendAvailable ? `${APP_CONFIG.DJANGO_API_URL.replace(/\/$/, '')}/events/` : APP_CONFIG.APPS_SCRIPT_URL;
  if (!APP_CONFIG.DATA_SYNC_ENABLED || !endpoint || !navigator.onLine) return;
  for (let batchIndex = 0; batchIndex < 10; batchIndex += 1) {
    const queue = getSyncQueue();
    if (!queue.length) return;
    const batch = queue.slice(0, 20);
    const succeeded = new Set();
    let failed = false;
    for (const event of batch) {
      try {
        const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, credentials:state.backendAvailable ? 'include' : 'omit', body:JSON.stringify(event) });
        if (!response.ok) throw new Error('network-response');
        const result = JSON.parse(await response.text());
        if (!result?.ok) throw new Error('server-rejected');
        succeeded.add(event.requestId);
      } catch (error) { failed = true; }
    }
    const preserved = getSyncQueue().filter(event => !succeeded.has(event.requestId));
    saveSyncQueue(preserved);
    if (failed || !preserved.length) return;
  }
}

export function eventLabel(type) {
  return ({ user_registered:'사용자 시작', user_visited:'방문', course_viewed:'코스 조회', course_started:'코스 시작', start_verified:'출발 인증', photo_verified:'사진 인증', finish_verified:'도착 인증', course_completed:'완주', restaurant_clicked:'맛집 조회', directions_clicked:'길찾기', record_shared:'기록 공유' })[type] || type;
}
