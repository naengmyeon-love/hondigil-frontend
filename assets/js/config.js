export const APP_CONFIG = Object.freeze({
  APPS_SCRIPT_URL: '',
  DJANGO_API_URL: '',
  DEVELOPMENT_MODE: false,
  ALLOW_LOCATION_TEST: false,
  ADMIN_ENABLED: false,
  GPS_RADIUS_METERS: 300,
  DATA_SYNC_ENABLED: true
});

export const STORAGE_KEYS = Object.freeze({
  USER: 'hondigil:user',
  ACTIVE: 'hondigil:active-course',
  RECORDS: 'hondigil:records',
  EVENTS: 'hondigil:events',
  METRICS: 'hondigil:metrics',
  QUEUE: 'hondigil:sync-queue',
  PENDING_COMPLETIONS: 'hondigil:pending-completions',
  LAST_RECORD: 'hondigil:last-record-id',
  PREFERENCES: 'hondigil:preferences'
});

export const SESSION_KEYS = Object.freeze({ ADMIN: 'hondigil:admin-session' });

export const ALLOWED_EVENT_TYPES = new Set([
  'user_registered', 'user_visited', 'course_viewed', 'course_started',
  'start_verified', 'finish_verified', 'photo_verified', 'course_completed',
  'restaurant_clicked', 'directions_clicked', 'record_shared'
]);
