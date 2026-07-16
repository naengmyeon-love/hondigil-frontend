import { APP_CONFIG, SESSION_KEYS, STORAGE_KEYS } from './config.js';
import { courseById } from './data/courses.js';
import { state, dispatchToast } from './state.js';
import {
  getRecords, getUser, migrateLegacyV3, readStored, removeStored, repairStoredData,
  resetAllData, savePreferences, saveRecords, saveUser, writeStored
} from './storage.js';
import { createId, escapeHTML, normalizeNickname } from './utils.js';
import { closeModal, openConfirm, openModal, trapModalFocus } from './components/modal.js';
import { initToast } from './components/toast.js';
import { navigate, render } from './router.js';
import {
  completeCourse, handlePhotoSelection, openLocationPurpose, performPendingAction,
  removePhoto, requestStartCourse, resumeCourse, stopCourse, testCompleteAll,
  testVerifyLocation, verifyLocation
} from './services/activity.js';
import { probeDjangoBackend, reportBackendSyncFailure, syncDjangoBootstrap, syncNicknameWithBackend } from './services/backend.js';
import { flushEventQueue, logEvent } from './services/events.js';
import { shareRecord } from './services/sharing.js';

function applyPreferences() {
  const prefs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFERENCES) || '{}');
  document.documentElement.classList.toggle('large-text', prefs.largeText === true);
  document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion === true);
}

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'directions') { logEvent('directions_clicked', { restaurantId:target.dataset.restaurantId, map:target.dataset.map }); return; }
  event.preventDefault();
  if (action === 'navigate') navigate(target.dataset.page);
  else if (action === 'view-course') {
    state.selectedCourseId = target.dataset.courseId; logEvent('course_viewed', { courseId:state.selectedCourseId }); navigate('course', { id:state.selectedCourseId });
  }
  else if (action === 'filter-type') { state.filters.type = target.dataset.value; render(); }
  else if (action === 'reset-filters') { state.filters = { type:'all', distance:'all', difficulty:'all' }; render(); }
  else if (action === 'start-course') requestStartCourse(target.dataset.courseId);
  else if (action === 'resume-course') resumeCourse();
  else if (action === 'stop-course') stopCourse();
  else if (action === 'request-location') openLocationPurpose(target.dataset.target);
  else if (action === 'confirm-location') await verifyLocation(target.dataset.target);
  else if (action === 'test-location') await testVerifyLocation(target.dataset.target);
  else if (action === 'test-complete-all') await testCompleteAll();
  else if (action === 'remove-photo') removePhoto();
  else if (action === 'complete-course') await completeCourse();
  else if (action === 'view-restaurants') { state.selectedCourseId = target.dataset.courseId; navigate('restaurants'); }
  else if (action === 'restaurant-click') { logEvent('restaurant_clicked', { restaurantId:target.dataset.restaurantId, courseId:state.selectedCourseId }); dispatchToast('맛집 관심 기록을 저장했어요.'); }
  else if (action === 'share-record') await shareRecord(target.dataset.recordId);
  else if (action === 'close-modal' || (action === 'backdrop-close' && event.target === target)) closeModal();
  else if (action === 'confirm-pending') await confirmPendingAction();
  else if (action === 'change-nickname') openNicknameChange();
  else if (action === 'delete-nickname') openConfirm('닉네임을 삭제할까요?', '완주 기록과 설정은 유지하고 시작 화면으로 돌아갑니다.', '닉네임 삭제', 'delete-nickname');
  else if (action === 'reset-records') openConfirm('완주 기록을 초기화할까요?', '진행 중 코스와 완주 기록이 삭제되지만 닉네임은 유지됩니다.', '기록 초기화', 'reset-records');
  else if (action === 'delete-all') openConfirm('모든 저장 데이터를 지울까요?', '닉네임, 진행 중 코스, 완주 기록과 설정이 모두 삭제됩니다.', '모두 삭제', 'delete-all');
  else if (action === 'admin-logout') { try { sessionStorage.removeItem(SESSION_KEYS.ADMIN); } catch (error) {} navigate('settings'); }
}

async function confirmPendingAction() {
  const action = state.pendingConfirmAction;
  if (action === 'reset-records') {
    closeModal(); state.pendingConfirmAction = '';
    removeStored(STORAGE_KEYS.ACTIVE); removeStored(STORAGE_KEYS.RECORDS); removeStored(STORAGE_KEYS.LAST_RECORD); removeStored(STORAGE_KEYS.PENDING_COMPLETIONS);
    state.lastRecord = null; navigate('jejuroom'); dispatchToast('완주 기록을 초기화했어요.'); return;
  }
  if (action === 'delete-all') {
    closeModal(); state.pendingConfirmAction = ''; resetAllData(); state.lastRecord = null; render(); dispatchToast('브라우저 저장 데이터를 삭제했어요.'); return;
  }
  if (action === 'delete-nickname') {
    closeModal(); state.pendingConfirmAction = ''; removeStored(STORAGE_KEYS.USER); state.backendProfile = null; render(); dispatchToast('닉네임을 삭제했어요.'); return;
  }
  await performPendingAction();
}

function openNicknameChange() {
  const user = getUser(); if (!user) return;
  openModal(`<div class="modal-head"><div><p class="eyebrow">내 정보</p><h2 id="modal-title">닉네임 변경</h2></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><p>홈과 나의 제주방에 표시할 이름을 입력해 주세요.</p><form id="nickname-change-form" novalidate><div class="field"><label for="new-nickname">새 닉네임</label><input class="input" id="new-nickname" name="nickname" maxlength="12" value="${escapeHTML(user.nickname)}" required><p class="form-message" id="nickname-change-error" role="alert"></p></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">취소</button><button class="btn btn-primary" type="submit">변경하기</button></div></form>`, '#new-nickname');
}

async function handleSubmit(event) {
  if (event.target.id === 'nickname-form' || event.target.id === 'nickname-change-form') {
    event.preventDefault();
    const input = event.target.elements.nickname;
    const nickname = normalizeNickname(input.value);
    const error = document.getElementById(event.target.id === 'nickname-form' ? 'nickname-error' : 'nickname-change-error');
    if (nickname.length < 2) { error.textContent = '닉네임을 2자 이상 입력해 주세요.'; input.setAttribute('aria-invalid','true'); input.focus(); return; }
    const previous = getUser() || readStored(STORAGE_KEYS.USER, null);
    const isFirst = !previous?.id;
    const user = { id:previous?.id || createId('anon'), nickname, createdAt:previous?.createdAt || new Date().toISOString(), lastVisitedAt:new Date().toISOString() };
    saveUser(user);
    if (state.backendAvailable) syncNicknameWithBackend(nickname).catch(error => reportBackendSyncFailure(error, '닉네임을 브라우저에만 저장했습니다.'));
    if (isFirst) logEvent('user_registered', { result:'success', userId:user.id });
    logEvent('user_visited', { result:'success', userId:user.id, userAgent:navigator.userAgent.slice(0,240) });
    closeModal(); navigate('home', { replace:true }); render(); dispatchToast(`${nickname}님, 혼디길에 오신 것을 환영해요.`); return;
  }
  if (event.target.id === 'admin-login-form') {
    event.preventDefault(); const input = event.target.elements.password; const error = document.getElementById('admin-error');
    if (input.value !== '0000') { error.textContent = '비밀번호가 맞지 않습니다.'; input.value = ''; input.focus(); return; }
    try { sessionStorage.setItem(SESSION_KEYS.ADMIN, 'true'); render(); dispatchToast('관리자 화면을 열었습니다.'); }
    catch (exception) { error.textContent = '세션 저장을 사용할 수 없습니다.'; }
  }
}

async function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-filter]')) { state.filters[target.dataset.filter] = target.value; render(); }
  else if (target.id === 'photo-input') await handlePhotoSelection(target);
  else if (target.dataset.setting) {
    const value = target.type === 'checkbox' ? target.checked : target.value;
    savePreferences({ [target.dataset.setting]:value }); applyPreferences();
    if (target.dataset.setting === 'background') render(); else dispatchToast('화면 설정을 저장했어요.');
  }
}

function initializeApp() {
  if (state.initialized) return;
  state.initialized = true;
  repairStoredData(); migrateLegacyV3(); applyPreferences(); initToast();
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.querySelector('.modal')) closeModal(); else trapModalFocus(event); });
  window.addEventListener('hashchange', render);
  window.addEventListener('hondigil:render', render);
  window.addEventListener('hondigil:navigate', event => navigate(event.detail.page, event.detail.options));
  window.addEventListener('online', flushEventQueue);
  window.addEventListener('storage', event => { if (Object.values(STORAGE_KEYS).includes(event.key)) render(); });
  if (!location.hash) history.replaceState(null, '', '#home');
  render();
  const user = getUser();
  if (user) logEvent('user_visited', { result:'success', userId:user.id, userAgent:navigator.userAgent.slice(0,240) });
  if (APP_CONFIG.DJANGO_API_URL) probeDjangoBackend().then(available => available ? syncDjangoBootstrap() : false).catch(() => { state.backendAvailable = false; });
}

initializeApp();
