const CONSENT_KEY = 'hondigil_analytics_consent_v1';
const QUEUE_KEY = 'hondigil_analytics_queue_v1';
const STATS_KEY = 'hondigil_analytics_delivery_v1';
const REPORT_KEY = 'hondigil_analytics_report_v1';
const SESSION_KEY = 'hondigil_analytics_session_v1';
const VISIT_KEY = 'hondigil_analytics_visit_v1';
const FLUSH_LEASE_KEY = 'hondigil_analytics_flush_lease_v1';
const CONSENT_VERSION = '2026-07-21';
const EPOCH_KEY = 'hondigil_analytics_consent_epoch_v1';
const APP_VERSION = '2026.07.21';
const MAX_QUEUE_SIZE = 200;
const MAX_BATCH_SIZE = 19;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const FLUSH_LEASE_MS = REQUEST_TIMEOUT_MS * 3;
const MAX_LOCAL_COUNTER = 1000000000;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_NAMES = new Set(['home', 'courses', 'course_detail', 'activity', 'completion', 'room', 'history', 'settings', 'restaurants']);
const ACTIVITY_MODES = new Set(['demo', 'gps']);
const GEOLOCATION_RESULTS = new Set(['success', 'permission_denied', 'unavailable', 'timeout', 'error']);
const ACCURACY_BUCKETS = new Set(['under_25m', '25_to_50m', '50_to_100m', 'over_100m']);

let csrfToken = '';
let collectorReady = false;
let initialization = null;
let flushPromise = null;
let flushTimer = null;
let withdrawalTimer = null;
let retryAfter = 0;
let failureCount = 0;
let withdrawalFailureCount = 0;
let pendingReportMemory = null;
const activeControllers = new Set();

function storageGet(storage, key) {
  try { return storage.getItem(key); } catch (_error) { return null; }
}

function storageSet(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch (_error) { return false; }
}

function storageRemove(storage, key) {
  try { storage.removeItem(key); } catch (_error) {}
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return prefix + window.crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 14);
  return prefix + Date.now().toString(36) + '_' + random;
}

export function createAnalyticsJourneyId() {
  return createId('jny_');
}

function apiBase() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    if (location.port === '8000') return location.origin + '/api/v1';
    return location.protocol + '//' + location.hostname + ':8000/api/v1';
  }
  const meta = document.querySelector('meta[name="hondigil-api-base"]');
  return String(meta && meta.content || '').replace(/\/$/, '');
}

function sessionId() {
  let value = storageGet(sessionStorage, SESSION_KEY);
  if (!value || !ID_PATTERN.test(value)) {
    value = createId('ses_');
    storageSet(sessionStorage, SESSION_KEY, value);
  }
  return value;
}

function scopedStorageKey(base) {
  // The delivery queue belongs to the browser installation, not a tab. Events
  // keep their own per-tab sessionId, while a short lease serializes sending.
  return base;
}

function visitMarker(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    if (parts.year && parts.month && parts.day) {
      return CONSENT_VERSION + ':' + parts.year + '-' + parts.month + '-' + parts.day;
    }
  } catch (_error) {}
  return CONSENT_VERSION + ':' + now.toISOString().slice(0, 10);
}

function readFlushLease() {
  try { return JSON.parse(storageGet(localStorage, FLUSH_LEASE_KEY) || 'null'); }
  catch (_error) { return null; }
}

function acquireFlushLease() {
  const current = readFlushLease();
  const now = Date.now();
  if (current && current.owner !== sessionId() && Number(current.expiresAt) > now) return '';
  const token = createId('lease_');
  const lease = {owner: sessionId(), token, expiresAt: now + FLUSH_LEASE_MS};
  if (!storageSet(localStorage, FLUSH_LEASE_KEY, JSON.stringify(lease))) return '';
  const confirmed = readFlushLease();
  return confirmed && confirmed.owner === lease.owner && confirmed.token === token ? token : '';
}

function renewFlushLease(token) {
  const current = readFlushLease();
  if (!current || current.owner !== sessionId() || current.token !== token) return false;
  current.expiresAt = Date.now() + FLUSH_LEASE_MS;
  return storageSet(localStorage, FLUSH_LEASE_KEY, JSON.stringify(current));
}

function releaseFlushLease(token) {
  const current = readFlushLease();
  if (current && current.owner === sessionId() && current.token === token) {
    storageRemove(localStorage, FLUSH_LEASE_KEY);
  }
}

function consentEpoch() {
  const value = storageGet(localStorage, EPOCH_KEY) || '';
  return UUID_PATTERN.test(value) ? value : '';
}

function setConsentEpoch(value) {
  if (!UUID_PATTERN.test(String(value || ''))) return false;
  const next = String(value);
  if (consentEpoch() && consentEpoch() !== next) clearAllPersistentAnalyticsState();
  storageSet(localStorage, EPOCH_KEY, next);
  return true;
}

function clearAllPersistentAnalyticsState() {
  pendingReportMemory = null;
  try {
    const prefixes = [QUEUE_KEY, STATS_KEY, REPORT_KEY, FLUSH_LEASE_KEY];
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && prefixes.some((prefix) => key === prefix || key.startsWith(prefix + ':'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (_error) {}
}

function clampCounter(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? Math.min(number, MAX_LOCAL_COUNTER) : 0;
}

function readStats() {
  try {
    const parsed = JSON.parse(storageGet(localStorage, scopedStorageKey(STATS_KEY)) || '{}');
    return {
      generatedCount: clampCounter(parsed.generatedCount),
      acknowledgedCount: clampCounter(parsed.acknowledgedCount),
      rejectedCount: clampCounter(parsed.rejectedCount),
      droppedCount: clampCounter(parsed.droppedCount),
    };
  } catch (_error) {
    return {generatedCount: 0, acknowledgedCount: 0, rejectedCount: 0, droppedCount: 0};
  }
}

function updateStats(changes) {
  const stats = readStats();
  Object.keys(changes).forEach((key) => {
    stats[key] = clampCounter(stats[key] + changes[key]);
  });
  storageSet(localStorage, scopedStorageKey(STATS_KEY), JSON.stringify(stats));
  return stats;
}

function writeStats(stats) {
  storageSet(localStorage, scopedStorageKey(STATS_KEY), JSON.stringify({
    generatedCount: clampCounter(stats.generatedCount),
    acknowledgedCount: clampCounter(stats.acknowledgedCount),
    rejectedCount: clampCounter(stats.rejectedCount),
    droppedCount: clampCounter(stats.droppedCount),
  }));
}

function validQueuedEvent(value) {
  if (!value || typeof value !== 'object') return false;
  if (!ID_PATTERN.test(String(value.requestId || ''))) return false;
  if (!consentEpoch() || value.consentEpoch !== consentEpoch()) return false;
  const occurredAt = Date.parse(value.occurredAt);
  const now = Date.now();
  return Number.isFinite(occurredAt)
    && occurredAt >= now - MAX_EVENT_AGE_MS
    && occurredAt <= now + MAX_FUTURE_SKEW_MS;
}

function readQueue() {
  try {
    const key = scopedStorageKey(QUEUE_KEY);
    const parsed = JSON.parse(storageGet(localStorage, key) || '[]');
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(validQueuedEvent).slice(-MAX_QUEUE_SIZE);
    if (valid.length !== parsed.length) {
      storageSet(localStorage, key, JSON.stringify(valid));
      updateStats({droppedCount: parsed.length - valid.length});
    }
    return valid;
  } catch (_error) {
    return [];
  }
}

function writeQueue(queue) {
  storageSet(localStorage, scopedStorageKey(QUEUE_KEY), JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
}

function validId(value) {
  const text = String(value || '');
  return ID_PATTERN.test(text) ? text : '';
}

function sanitizeEventData(eventType, input) {
  const data = input && typeof input === 'object' ? input : {};
  const courseId = validId(data.courseId);
  const restaurantId = validId(data.restaurantId);
  if (eventType === 'page_viewed') {
    if (!PAGE_NAMES.has(data.page)) return null;
    const page = data.page;
    return courseId ? {page, courseId} : {page};
  }
  if (eventType === 'course_viewed') {
    return courseId ? {courseId} : null;
  }
  if (eventType === 'course_flow_started' || eventType === 'course_flow_completed') {
    return courseId && ACTIVITY_MODES.has(data.mode) ? {courseId, mode: data.mode} : null;
  }
  if (eventType === 'restaurant_impression' || eventType === 'restaurant_clicked' || eventType === 'directions_clicked') {
    if (!restaurantId) return null;
    return courseId ? {restaurantId, courseId} : {restaurantId};
  }
  if (eventType === 'geolocation_result') {
    if (!courseId || !GEOLOCATION_RESULTS.has(data.result)) return null;
    if (data.result === 'success') {
      return ACCURACY_BUCKETS.has(data.accuracyBucket)
        ? {courseId, result: data.result, accuracyBucket: data.accuracyBucket}
        : null;
    }
    return {courseId, result: data.result};
  }
  return null;
}

function makeEvent(eventType, data, options = {}) {
  const safeData = sanitizeEventData(eventType, data);
  const epoch = consentEpoch();
  if (!safeData || !epoch) return null;
  const event = {
    schemaVersion: 1,
    requestId: createId('evt_'),
    eventType,
    consentEpoch: epoch,
    sessionId: sessionId(),
    appVersion: APP_VERSION,
    occurredAt: new Date().toISOString(),
    data: safeData,
  };
  const activityId = validId(options.activityId);
  if (activityId) event.activityId = activityId;
  const journeyId = validId(options.journeyId);
  if (journeyId) event.journeyId = journeyId;
  return event;
}

function createDeliveryReport(queueDepth) {
  const stats = readStats();
  const epoch = consentEpoch();
  if (!epoch) return null;
  const depth = Math.min(Math.max(0, queueDepth), 10000);
  let remaining = 10000 - depth;
  const acknowledgedCount = Math.min(stats.acknowledgedCount, remaining);
  remaining -= acknowledgedCount;
  const rejectedCount = Math.min(stats.rejectedCount, remaining);
  remaining -= rejectedCount;
  const droppedCount = Math.min(stats.droppedCount, remaining);
  const data = {acknowledgedCount, rejectedCount, droppedCount, queueDepth: depth};
  data.generatedCount = data.acknowledgedCount
    + data.rejectedCount
    + data.droppedCount
    + data.queueDepth;
  return {
    schemaVersion: 1,
    requestId: createId('evt_'),
    eventType: 'analytics_delivery_report',
    consentEpoch: epoch,
    sessionId: sessionId(),
    appVersion: APP_VERSION,
    occurredAt: new Date().toISOString(),
    data,
  };
}

function isValidDeliveryReport(value) {
  if (!validQueuedEvent(value) || value.eventType !== 'analytics_delivery_report') return false;
  const data = value.data;
  if (!data || typeof data !== 'object') return false;
  const fields = ['generatedCount', 'acknowledgedCount', 'rejectedCount', 'droppedCount', 'queueDepth'];
  if (!fields.every((field) => Number.isInteger(data[field]) && data[field] >= 0 && data[field] <= 10000)) return false;
  return data.generatedCount === data.acknowledgedCount
    + data.rejectedCount
    + data.droppedCount
    + data.queueDepth;
}

function readPendingReport() {
  if (isValidDeliveryReport(pendingReportMemory)) return pendingReportMemory;
  try {
    const parsed = JSON.parse(storageGet(localStorage, scopedStorageKey(REPORT_KEY)) || 'null');
    if (isValidDeliveryReport(parsed)) {
      pendingReportMemory = parsed;
      return parsed;
    }
  } catch (_error) {}
  storageRemove(localStorage, scopedStorageKey(REPORT_KEY));
  pendingReportMemory = null;
  return null;
}

function writePendingReport(report) {
  pendingReportMemory = report;
  storageSet(localStorage, scopedStorageKey(REPORT_KEY), JSON.stringify(report));
}

function clearPendingReport() {
  pendingReportMemory = null;
  storageRemove(localStorage, scopedStorageKey(REPORT_KEY));
}

function pendingDeliveryReport(queueDepth) {
  const existing = readPendingReport();
  if (existing) return existing;
  const report = createDeliveryReport(queueDepth);
  if (!report) return null;
  writePendingReport(report);
  return report;
}

async function request(path, options = {}) {
  const base = apiBase();
  if (!base) throw new Error('analytics_api_disabled');
  const controller = new AbortController();
  activeControllers.add(controller);
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrfToken && options.method && options.method !== 'GET') headers.set('X-CSRFToken', csrfToken);
  try {
    const response = await fetch(base + path, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: controller.signal,
    });
    let body = null;
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      body = await response.json();
    }
    return {response, body};
  } finally {
    activeControllers.delete(controller);
    window.clearTimeout(timeout);
  }
}

function stopCollectorRequests() {
  window.clearTimeout(flushTimer);
  flushTimer = null;
  activeControllers.forEach((controller) => controller.abort());
  activeControllers.clear();
  collectorReady = false;
  csrfToken = '';
}

async function prepareCollector({recordVisit = true} = {}) {
  if (!hasAnalyticsConsent()) return false;
  const bootstrap = await request('/bootstrap/', {method: 'GET'});
  if (!hasAnalyticsConsent()) return false;
  if (!bootstrap.response.ok || !bootstrap.body || !bootstrap.body.csrfToken) return false;
  csrfToken = bootstrap.body.csrfToken;
  let serverEpoch = UUID_PATTERN.test(String(bootstrap.body.analyticsConsentEpoch || ''))
    ? String(bootstrap.body.analyticsConsentEpoch)
    : '';
  const marker = visitMarker();
  const visitRecorded = storageGet(sessionStorage, VISIT_KEY) === marker;
  if (!bootstrap.body.analyticsAuthenticated || !serverEpoch || (recordVisit && !visitRecorded)) {
    if (!hasAnalyticsConsent()) return false;
    const session = await request('/analytics/session/', {method: 'POST', body: '{}'});
    if (!hasAnalyticsConsent()) return false;
    if (!session.response.ok || !session.body) return false;
    serverEpoch = String(session.body.consentEpoch || '');
    if (recordVisit) storageSet(sessionStorage, VISIT_KEY, marker);
  }
  if (!setConsentEpoch(serverEpoch)) return false;
  collectorReady = true;
  return true;
}

export function hasAnalyticsConsent() {
  return storageGet(localStorage, CONSENT_KEY) === 'granted:' + CONSENT_VERSION;
}

export function hasPendingAnalyticsWithdrawal() {
  return storageGet(localStorage, CONSENT_KEY) === 'withdrawal-pending:' + CONSENT_VERSION;
}

export function initAnalytics() {
  if (!hasAnalyticsConsent()) return Promise.resolve(false);
  if (!initialization) {
    initialization = prepareCollector()
      .then((ready) => {
        if (ready) scheduleFlush(0);
        return ready;
      })
      .catch(() => false)
      .finally(() => { initialization = null; });
  }
  return initialization;
}

export function setAnalyticsConsent(enabled) {
  if (enabled) {
    storageSet(localStorage, CONSENT_KEY, 'granted:' + CONSENT_VERSION);
    return initAnalytics().then((ready) => ({enabled: true, deleted: false, ready}));
  }
  return withdrawAnalyticsConsent();
}

function scheduleWithdrawalRetry() {
  window.clearTimeout(withdrawalTimer);
  if (!hasPendingAnalyticsWithdrawal() || !navigator.onLine) return;
  withdrawalFailureCount = Math.min(withdrawalFailureCount + 1, 8);
  const delay = Math.round(
    Math.min(30 * 60 * 1000, 5000 * Math.pow(2, withdrawalFailureCount - 1))
      * (.8 + Math.random() * .4)
  );
  withdrawalTimer = window.setTimeout(() => { void withdrawAnalyticsConsent(); }, delay);
}

export async function withdrawAnalyticsConsent() {
  const requiresServerDeletion = hasAnalyticsConsent() || hasPendingAnalyticsWithdrawal();
  let deleted = !requiresServerDeletion;
  storageSet(localStorage, CONSENT_KEY, 'withdrawal-pending:' + CONSENT_VERSION);
  window.clearTimeout(withdrawalTimer);
  stopCollectorRequests();
  if (requiresServerDeletion) {
    try {
      const bootstrap = await request('/bootstrap/', {method: 'GET'});
      if (bootstrap.response.ok && bootstrap.body && bootstrap.body.csrfToken) {
        csrfToken = bootstrap.body.csrfToken;
        if (bootstrap.body.analyticsAuthenticated) {
          const response = await request('/me/analytics/?withdraw=1', {method: 'DELETE'});
          deleted = response.response.ok && !!(response.body && response.body.ok);
        } else {
          deleted = true;
        }
      }
    } catch (_error) {
      deleted = false;
    }
  }
  storageSet(localStorage, CONSENT_KEY, (deleted ? 'denied:' : 'withdrawal-pending:') + CONSENT_VERSION);
  if (deleted) withdrawalFailureCount = 0;
  else scheduleWithdrawalRetry();
  clearAllPersistentAnalyticsState();
  storageRemove(sessionStorage, SESSION_KEY);
  storageRemove(sessionStorage, VISIT_KEY);
  storageRemove(localStorage, EPOCH_KEY);
  return {enabled: false, deleted, ready: false};
}

export async function deleteAnalyticsData() {
  const keepCollecting = hasAnalyticsConsent();
  stopCollectorRequests();
  try {
    const bootstrap = await request('/bootstrap/', {method: 'GET'});
    if (!bootstrap.response.ok || !bootstrap.body || !bootstrap.body.csrfToken) return {deleted: false};
    csrfToken = bootstrap.body.csrfToken;
    if (!bootstrap.body.analyticsAuthenticated) return {deleted: false, unavailable: true};
    const path = keepCollecting ? '/me/analytics/' : '/me/analytics/?withdraw=1';
    const result = await request(path, {method: 'DELETE'});
    if (!result.response.ok || !result.body || !result.body.ok) return {deleted: false};
    clearAllPersistentAnalyticsState();
    if (keepCollecting) {
      if (!setConsentEpoch(result.body.consentEpoch)) return {deleted: false};
      void initAnalytics();
    } else {
      storageRemove(localStorage, EPOCH_KEY);
    }
    return {deleted: true};
  } catch (_error) {
    return {deleted: false};
  }
}

export function track(eventType, data, options) {
  if (!hasAnalyticsConsent()) return false;
  const event = makeEvent(eventType, data, options);
  if (!event) return false;
  const queue = readQueue();
  let dropped = 0;
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
    dropped = 1;
  }
  queue.push(event);
  writeQueue(queue);
  updateStats({generatedCount: 1, droppedCount: dropped});
  scheduleFlush(250);
  return true;
}

function scheduleFlush(delay) {
  if (!hasAnalyticsConsent()) return;
  const remainingBackoff = Math.max(0, retryAfter - Date.now());
  const effectiveDelay = Math.max(delay, remainingBackoff);
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => { void flush(); }, effectiveDelay);
}

function deferRetry(response) {
  failureCount = Math.min(failureCount + 1, 8);
  let delay = Math.min(5 * 60 * 1000, 1000 * Math.pow(2, failureCount));
  const retryHeader = response && response.headers ? Number(response.headers.get('Retry-After')) : 0;
  if (Number.isFinite(retryHeader) && retryHeader > 0) delay = Math.min(30 * 60 * 1000, retryHeader * 1000);
  delay = Math.round(delay * (.8 + Math.random() * .4));
  retryAfter = Date.now() + delay;
  scheduleFlush(delay);
}

async function sendDeliveryReport(keepalive) {
  const queue = readQueue();
  const stats = readStats();
  const existing = readPendingReport();
  if (!existing && !queue.length && !stats.generatedCount && !stats.acknowledgedCount
    && !stats.droppedCount && !stats.rejectedCount) return true;
  const report = existing || pendingDeliveryReport(queue.length);
  if (!report) return false;
  const reportEpoch = report.consentEpoch;
  try {
    const result = await request('/events/batch/', {
      method: 'POST',
      body: JSON.stringify({events: [report]}),
      keepalive,
    });
    if (consentEpoch() !== reportEpoch) {
      scheduleFlush(50);
      return false;
    }
    const item = result.body && Array.isArray(result.body.results) ? result.body.results[0] : null;
    if (!result.response.ok || !item) return false;
    if (item.status === 'rejected') {
      // A validated, immutable snapshot that the server rejects cannot become
      // valid by retrying forever. Drop only that telemetry snapshot so user
      // events and later reports can continue.
      const latestQueue = readQueue();
      const latestStats = readStats();
      const snapshot = report.data;
      writeStats({
        generatedCount: Math.max(0, latestStats.acknowledgedCount - snapshot.acknowledgedCount)
          + Math.max(0, latestStats.rejectedCount - snapshot.rejectedCount)
          + Math.max(0, latestStats.droppedCount - snapshot.droppedCount)
          + latestQueue.length,
        acknowledgedCount: Math.max(0, latestStats.acknowledgedCount - snapshot.acknowledgedCount),
        rejectedCount: Math.max(0, latestStats.rejectedCount - snapshot.rejectedCount),
        droppedCount: Math.max(0, latestStats.droppedCount - snapshot.droppedCount),
      });
      clearPendingReport();
      scheduleFlush(50);
      return true;
    }
    if (!['accepted', 'duplicate'].includes(item.status)) return false;
    const latestQueue = readQueue();
    const latestStats = readStats();
    const snapshot = report.data;
    const acknowledgedCount = Math.max(0, latestStats.acknowledgedCount - snapshot.acknowledgedCount);
    const rejectedCount = Math.max(0, latestStats.rejectedCount - snapshot.rejectedCount);
    const droppedCount = Math.max(0, latestStats.droppedCount - snapshot.droppedCount);
    writeStats({
      generatedCount: acknowledgedCount + rejectedCount + droppedCount + latestQueue.length,
      acknowledgedCount,
      rejectedCount,
      droppedCount,
    });
    clearPendingReport();
    if (acknowledgedCount || rejectedCount || droppedCount) scheduleFlush(50);
    return true;
  } catch (_error) {
    return false;
  }
}

export async function flush({keepalive = false} = {}) {
  if (!hasAnalyticsConsent() || Date.now() < retryAfter) return false;
  if (flushPromise) return flushPromise;
  const leaseToken = acquireFlushLease();
  if (!leaseToken) {
    scheduleFlush(1000);
    return false;
  }
  flushPromise = (async () => {
    if (!collectorReady && !(await initAnalytics())) {
      deferRetry(null);
      return false;
    }
    const queue = readQueue();
    if (!queue.length) {
      const reported = await sendDeliveryReport(keepalive);
      if (!reported) {
        deferRetry(null);
        return false;
      }
      retryAfter = 0;
      failureCount = 0;
      return true;
    }
    const pending = queue.slice(0, MAX_BATCH_SIZE);
    const batchEpoch = consentEpoch();
    try {
      if (!renewFlushLease(leaseToken)) return false;
      const result = await request('/events/batch/', {
        method: 'POST',
        body: JSON.stringify({events: pending}),
        keepalive,
      });
      if (!batchEpoch || consentEpoch() !== batchEpoch) {
        scheduleFlush(50);
        return false;
      }
      if (!result.response.ok || !result.body || !Array.isArray(result.body.results)) {
        if (result.response.status === 401 || result.response.status === 403) {
          collectorReady = false;
          csrfToken = '';
        }
        deferRetry(result.response);
        return false;
      }
      if (result.body.results.some((item) => item && item.code === 'CONSENT_EPOCH_EXPIRED')) {
        stopCollectorRequests();
        clearAllPersistentAnalyticsState();
        storageRemove(localStorage, EPOCH_KEY);
        void initAnalytics();
        return false;
      }
      const completed = new Map();
      result.body.results.forEach((item) => {
        if (item && typeof item.requestId === 'string') completed.set(item.requestId, item.status);
      });
      let acknowledged = 0;
      let rejected = 0;
      const completedIds = new Set();
      pending.forEach((event) => {
        const status = completed.get(event.requestId);
        if (status === 'accepted' || status === 'duplicate') {
          acknowledged += 1;
          completedIds.add(event.requestId);
        } else if (status === 'rejected') {
          rejected += 1;
          completedIds.add(event.requestId);
        }
      });
      const latestQueue = readQueue().filter((event) => !completedIds.has(event.requestId));
      writeQueue(latestQueue);
      updateStats({acknowledgedCount: acknowledged, rejectedCount: rejected});
      const reported = await sendDeliveryReport(keepalive);
      if (!reported) {
        deferRetry(result.response);
        return false;
      }
      retryAfter = 0;
      failureCount = 0;
      if (latestQueue.length) scheduleFlush(50);
      return true;
    } catch (_error) {
      deferRetry(null);
      return false;
    }
  })().finally(() => { releaseFlushLease(leaseToken); flushPromise = null; });
  return flushPromise;
}

window.addEventListener('online', () => {
  if (hasPendingAnalyticsWithdrawal()) void withdrawAnalyticsConsent();
  else scheduleFlush(0);
});
window.addEventListener('storage', (event) => {
  if (event.key === EPOCH_KEY) {
    stopCollectorRequests();
    clearAllPersistentAnalyticsState();
    if (hasAnalyticsConsent() && consentEpoch()) void initAnalytics();
    return;
  }
  if (event.key !== CONSENT_KEY) return;
  if (hasAnalyticsConsent()) void initAnalytics();
  else {
    stopCollectorRequests();
    pendingReportMemory = null;
    if (hasPendingAnalyticsWithdrawal() && navigator.onLine) void withdrawAnalyticsConsent();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush({keepalive: true});
});

if (hasPendingAnalyticsWithdrawal() && navigator.onLine) void withdrawAnalyticsConsent();
