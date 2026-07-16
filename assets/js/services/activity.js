import { APP_CONFIG, STORAGE_KEYS } from '../config.js';
import { courseById } from '../data/courses.js';
import { state, dispatchNavigate, dispatchRender, dispatchToast } from '../state.js';
import {
  getActiveCourse, getPendingCompletions, getRecords, readStored, saveActiveCourse,
  savePendingCompletions, saveRecords, updateActiveCourse, writeStored
} from '../storage.js';
import { createId, escapeHTML, formatDuration } from '../utils.js';
import { closeModal, openConfirm, openModal } from '../components/modal.js';
import { completeBackendActivity, reportBackendSyncFailure, stopBackendActivity, syncStartedActivity, verifyBackendLocation, verifyBackendPhoto } from './backend.js';
import { logEvent } from './events.js';
import { distanceInMeters, getCurrentPosition, locationErrorMessage } from './gps.js';

export function beginCourse(courseId, replaceExisting = false) {
  const course = courseById(courseId);
  if (!course) return;
  const active = getActiveCourse();
  if (active && !replaceExisting) {
    if (active.courseId === courseId) { resumeCourse(); return; }
    openConfirm('진행 중인 코스를 바꿀까요?', '현재 코스의 인증 진행 내용은 사라집니다.', '새 코스 시작', `start:${courseId}`);
    return;
  }
  const next = { id:createId('activity'), backendActivityId:'', courseId, startedAt:new Date().toISOString(), startVerified:false, finishVerified:false, photoVerified:false, photoName:'', startLocation:null, finishLocation:null, photoMeta:null, currentStep:'start' };
  saveActiveCourse(next);
  state.selectedCourseId = courseId;
  state.gpsMessage = ''; state.gpsTone = '';
  logEvent('course_started', { courseId });
  syncStartedActivity(next.id, courseId, replaceExisting).catch(error => reportBackendSyncFailure(error));
  dispatchNavigate('progress');
}

export function resumeCourse() {
  const active = getActiveCourse();
  if (!active) { dispatchNavigate('courses'); return; }
  state.selectedCourseId = active.courseId;
  dispatchNavigate('progress');
}

export function requestStartCourse(courseId) {
  const active = getActiveCourse();
  if (active && active.courseId !== courseId) {
    openConfirm('다른 코스로 바꿀까요?', '현재 진행 내용은 삭제되고 선택한 코스를 새로 시작합니다.', '바꾸고 시작', `start:${courseId}`);
  } else beginCourse(courseId, false);
}

export function stopCourse() {
  const active = getActiveCourse();
  if (!active) return;
  openConfirm('코스를 중단할까요?', '현재 인증 진행 내용은 삭제됩니다.', '코스 중단', 'stop-course');
}

export function openLocationPurpose(targetType) {
  const active = getActiveCourse();
  const course = active && courseById(active.courseId);
  if (!course) return;
  const isStart = targetType === 'start';
  const insecure = !window.isSecureContext && location.hostname !== 'localhost'
    ? '<div class="status-box warning"><strong>HTTPS 안내</strong><br>현재 주소에서는 브라우저가 위치 권한을 제한할 수 있습니다.</div>' : '';
  openModal(`<div class="modal-head"><div><p class="eyebrow">위치 사용 안내</p><h2 id="modal-title">${isStart ? '출발' : '도착'} 위치를 확인할게요</h2></div><button type="button" class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div>
    <p>버튼을 누른 순간의 위치만 확인하며, 이동 경로를 계속 추적하거나 서버에 원본 좌표를 저장하지 않습니다.</p>
    <div class="info-block compact"><strong>${escapeHTML(isStart ? course.startName : course.endName)}</strong><p>기준 지점 ${APP_CONFIG.GPS_RADIUS_METERS}m 안에서 인증할 수 있어요.</p></div>${insecure}
    <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">취소</button><button type="button" class="btn btn-primary" data-action="confirm-location" data-target="${targetType}">위치 확인 시작</button></div>`);
}

export async function verifyLocation(targetType) {
  closeModal();
  const active = getActiveCourse();
  const course = active && courseById(active.courseId);
  if (!active || !course) return;
  state.gpsMessage = '현재 위치를 확인하고 있어요…'; state.gpsTone = ''; dispatchRender();
  try {
    const position = await getCurrentPosition();
    const location = { latitude:position.coords.latitude, longitude:position.coords.longitude, accuracy:Number(position.coords.accuracy || 0), capturedAt:new Date().toISOString() };
    const point = targetType === 'start' ? course.start : course.end;
    const distance = distanceInMeters(location, { latitude:point[0], longitude:point[1] });
    if (distance > APP_CONFIG.GPS_RADIUS_METERS) {
      state.gpsMessage = `${targetType === 'start' ? '출발지' : '도착지'}에서 약 ${Math.round(distance)}m 떨어져 있어요. 기준 지점 가까이에서 다시 시도해 주세요.`;
      state.gpsTone = 'error'; dispatchRender(); return;
    }
    const changes = targetType === 'start' ? { startVerified:true, startLocation:location } : { finishVerified:true, finishLocation:location };
    const updated = updateActiveCourse(changes);
    state.gpsMessage = `${targetType === 'start' ? '출발' : '도착'} 위치 인증을 완료했어요.`; state.gpsTone = '';
    logEvent(targetType === 'start' ? 'start_verified' : 'finish_verified', { courseId:course.id, distanceMeters:Math.round(distance) });
    try {
      const result = await verifyBackendLocation(updated, targetType, location);
      if (result?.activity) saveActiveCourse({ ...updated, ...result.activity, backendActivityId:String(result.activity.id), startLocation:updated.startLocation, finishLocation:updated.finishLocation, photoMeta:updated.photoMeta });
    } catch (error) { reportBackendSyncFailure(error); }
    dispatchRender();
  } catch (error) {
    state.gpsMessage = error?.message === 'UNSUPPORTED' ? '이 브라우저는 위치 기능을 지원하지 않아요.' : locationErrorMessage(error);
    state.gpsTone = 'error'; dispatchRender();
  }
}

export async function testVerifyLocation(targetType) {
  if (!(APP_CONFIG.DEVELOPMENT_MODE && APP_CONFIG.ALLOW_LOCATION_TEST)) return;
  const active = getActiveCourse(); const course = active && courseById(active.courseId); if (!active || !course) return;
  const point = targetType === 'start' ? course.start : course.end;
  const location = { latitude:point[0], longitude:point[1], accuracy:5, capturedAt:new Date().toISOString(), developmentTest:true };
  updateActiveCourse(targetType === 'start' ? { startVerified:true, startLocation:location } : { finishVerified:true, finishLocation:location });
  logEvent(targetType === 'start' ? 'start_verified' : 'finish_verified', { courseId:course.id, developmentTest:true });
  dispatchRender();
}

export async function testCompleteAll() {
  if (!(APP_CONFIG.DEVELOPMENT_MODE && APP_CONFIG.ALLOW_LOCATION_TEST)) return;
  const active = getActiveCourse(); const course = active && courseById(active.courseId); if (!active || !course) return;
  const now = new Date().toISOString();
  saveActiveCourse({ ...active, startVerified:true, photoVerified:true, finishVerified:true, photoName:'development-test.jpg', photoMeta:{ requestId:createId('verify'), fileType:'image/jpeg', fileSize:1 }, startLocation:{latitude:course.start[0],longitude:course.start[1],accuracy:5,capturedAt:now,developmentTest:true}, finishLocation:{latitude:course.end[0],longitude:course.end[1],accuracy:5,capturedAt:now,developmentTest:true}, currentStep:'complete' });
  dispatchRender();
}

export async function handlePhotoSelection(input) {
  const file = input?.files?.[0];
  const active = getActiveCourse();
  if (!file || !active) return;
  if (!file.type.startsWith('image/')) { dispatchToast('이미지 파일만 선택할 수 있어요.'); input.value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { dispatchToast('사진은 10MB 이하로 선택해 주세요.'); input.value = ''; return; }
  if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
  state.photoPreviewUrl = URL.createObjectURL(file);
  const meta = { requestId:createId('verify'), fileType:file.type, fileSize:file.size };
  const updated = updateActiveCourse({ photoVerified:true, photoName:file.name.slice(0, 120), photoMeta:meta });
  logEvent('photo_verified', { courseId:active.courseId, fileType:file.type, fileSize:file.size });
  try {
    const result = await verifyBackendPhoto(updated, meta);
    if (result?.activity) saveActiveCourse({ ...updated, ...result.activity, backendActivityId:String(result.activity.id), photoMeta:meta });
  } catch (error) { reportBackendSyncFailure(error); }
  dispatchRender();
}

export function removePhoto() {
  if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
  state.photoPreviewUrl = '';
  updateActiveCourse({ photoVerified:false, finishVerified:false, photoName:'', photoMeta:null, finishLocation:null });
  dispatchRender();
}

export async function completeCourse() {
  const active = getActiveCourse();
  const course = active && courseById(active.courseId);
  if (!active || !course || !(active.startVerified && active.photoVerified && active.finishVerified)) { dispatchToast('출발 위치, 사진, 도착 위치 인증을 모두 완료해 주세요.'); return; }
  const localRecord = { id:createId('record'), activityId:active.id, courseId:course.id, courseName:course.name, distance:course.distance, durationMs:Math.max(60000, Date.now() - new Date(active.startedAt).getTime()), startedAt:active.startedAt, completedAt:new Date().toISOString(), startVerified:true, finishVerified:true, photoVerified:true };
  saveRecords([localRecord, ...getRecords()]); writeStored(STORAGE_KEYS.LAST_RECORD, localRecord.id); state.lastRecord = localRecord;
  try {
    const result = await completeBackendActivity(active);
    const serverRecord = result?.completion || result?.record;
    if (serverRecord) {
      saveRecords([serverRecord, ...getRecords().filter(record => record.id !== localRecord.id)]);
      writeStored(STORAGE_KEYS.LAST_RECORD, serverRecord.id); state.lastRecord = serverRecord;
    }
  } catch (error) {
    savePendingCompletions([...getPendingCompletions(), { localRecordId:localRecord.id, activity:active }]);
    reportBackendSyncFailure(error, '완주 기록을 브라우저에 저장했습니다. 연결되면 서버 동기화를 다시 시도합니다.');
  }
  saveActiveCourse(null);
  if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
  state.photoPreviewUrl = '';
  logEvent('course_completed', { courseId:course.id, recordId:state.lastRecord.id, durationMs:state.lastRecord.durationMs });
  dispatchNavigate('result');
}

export function progressStatus(active) {
  if (!active.startVerified) return '출발 위치를 확인해 주세요.';
  if (!active.photoVerified) return '코스에서 찍은 사진을 선택해 주세요.';
  if (!active.finishVerified) return '도착 지점에서 위치를 확인해 주세요.';
  return '모든 인증이 끝났어요. 완주 기록을 저장해 주세요.';
}

export function startElapsedTimer() {
  window.clearInterval(state.elapsedTimer);
  const update = () => {
    const active = getActiveCourse();
    const element = document.getElementById('elapsed-time');
    if (!active || !element) return;
    element.textContent = formatDuration(Date.now() - new Date(active.startedAt).getTime());
  };
  update(); state.elapsedTimer = window.setInterval(update, 1000);
}

export function stopElapsedTimer() {
  window.clearInterval(state.elapsedTimer); state.elapsedTimer = null;
}

export async function performPendingAction() {
  const action = state.pendingConfirmAction; state.pendingConfirmAction = ''; closeModal();
  if (action.startsWith('start:')) { const active = getActiveCourse(); if (active) stopBackendActivity(active).catch(() => undefined); beginCourse(action.slice(6), true); }
  else if (action === 'stop-course') {
    const active = getActiveCourse(); saveActiveCourse(null); stopBackendActivity(active).catch(error => reportBackendSyncFailure(error)); dispatchNavigate('courses');
  }
}

export function getLastRecord() {
  const id = readStored(STORAGE_KEYS.LAST_RECORD, '');
  return getRecords().find(record => record.id === id) || getRecords()[0] || null;
}
