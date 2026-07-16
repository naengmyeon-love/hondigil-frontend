export const state = {
  page: 'home',
  routeId: '',
  selectedCourseId: 'saryeoni',
  filters: { type: 'all', distance: 'all', difficulty: 'all' },
  lastRecord: null,
  photoPreviewUrl: '',
  gpsMessage: '',
  gpsTone: '',
  map: null,
  elapsedTimer: null,
  toastTimer: null,
  syncInFlight: null,
  backendAvailable: false,
  backendProfile: null,
  csrfToken: '',
  activitySyncPromise: null,
  pendingConfirmAction: '',
  returnFocus: null,
  initialized: false
};

export function dispatchRender() {
  window.dispatchEvent(new CustomEvent('hondigil:render'));
}

export function dispatchNavigate(page, options = {}) {
  window.dispatchEvent(new CustomEvent('hondigil:navigate', { detail: { page, options } }));
}

export function dispatchToast(message) {
  window.dispatchEvent(new CustomEvent('hondigil:toast', { detail: { message } }));
}
