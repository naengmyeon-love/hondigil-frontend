import { APP_CONFIG } from '../config.js';
import { courseById } from '../data/courses.js';
import { state } from '../state.js';
import { getActiveCourse } from '../storage.js';
import { escapeHTML, formatDate, formatDuration } from '../utils.js';
import { progressStatus } from '../services/activity.js';

export function renderActivity() {
  const active = getActiveCourse();
  if (!active) return '<div class="page"><div class="empty-state"><div class="empty-icon" aria-hidden="true">🥾</div><h1>진행 중인 코스가 없어요</h1><p>코스를 골라 시작해 주세요.</p><button type="button" class="btn btn-primary" data-action="navigate" data-page="courses">코스 찾기</button></div></div>';
  const course = courseById(active.courseId);
  const complete = active.startVerified && active.photoVerified && active.finishVerified;
  const test = APP_CONFIG.DEVELOPMENT_MODE && APP_CONFIG.ALLOW_LOCATION_TEST;
  return `<div class="page detail-content"><section class="progress-hero" aria-labelledby="progress-title"><p class="eyebrow">현재 진행 중</p><h1 id="progress-title">${escapeHTML(course.name)}</h1><p>${progressStatus(active)}</p><div class="progress-time"><div><span>시작 시각</span><strong>${formatDate(active.startedAt, true)}</strong></div><div><span>경과 시간</span><strong id="elapsed-time">${formatDuration(Date.now() - new Date(active.startedAt).getTime())}</strong></div></div></section>
    ${state.gpsMessage ? `<div class="status-box ${state.gpsTone}" id="gps-status" role="status" aria-live="polite">${escapeHTML(state.gpsMessage)}</div>` : ''}
    <section class="section" aria-labelledby="steps-heading"><div class="section-heading"><div><p class="eyebrow">세 단계로 완주</p><h2 id="steps-heading">인증 진행</h2></div></div><div class="step-list">
      <article class="step-card ${active.startVerified ? 'complete' : 'current'}"><span class="step-number" aria-hidden="true">${active.startVerified ? '✓' : '1'}</span><div><h3>출발 위치 인증</h3><p>출발지 ${APP_CONFIG.GPS_RADIUS_METERS}m 안에서 현재 위치를 확인합니다.</p>${active.startVerified ? '<p><strong>상태: 완료</strong></p>' : `<div class="verification-actions"><button type="button" class="btn btn-primary" data-action="request-location" data-target="start">출발 위치 확인하기</button>${test ? '<button class="btn btn-secondary" data-action="test-location" data-target="start">개발용 출발 인증</button>' : ''}</div>`}</div></article>
      <article class="step-card ${active.photoVerified ? 'complete' : active.startVerified ? 'current' : ''}"><span class="step-number" aria-hidden="true">${active.photoVerified ? '✓' : '2'}</span><div><h3>사진 인증</h3><p>코스에서 찍은 사진을 선택합니다. 원본은 저장하지 않아요.</p>${active.startVerified ? `<div class="verification-actions"><label class="btn btn-primary" for="photo-input">${active.photoVerified ? '다른 사진 선택하기' : '사진 촬영 또는 선택하기'}</label><input class="file-input" id="photo-input" type="file" accept="image/*" capture="environment"></div>${state.photoPreviewUrl ? `<div class="photo-preview"><img src="${state.photoPreviewUrl}" alt="선택한 완주 인증 사진 미리보기"><div class="photo-preview-footer"><strong>사진 인증 완료</strong><button class="btn btn-text" data-action="remove-photo">사진 삭제</button></div></div>` : active.photoVerified ? '<div class="status-box"><strong>사진 인증 완료</strong><br>새로고침 후 미리보기는 사라집니다.<button class="btn btn-text" data-action="remove-photo">사진 인증 취소</button></div>' : '<p class="help">사진을 선택하면 이 화면에서만 미리보기를 확인할 수 있습니다.</p>'}` : '<p class="help">먼저 출발 위치를 인증해 주세요.</p>'}</div></article>
      <article class="step-card ${active.finishVerified ? 'complete' : active.startVerified && active.photoVerified ? 'current' : ''}"><span class="step-number" aria-hidden="true">${active.finishVerified ? '✓' : '3'}</span><div><h3>도착 위치 인증</h3><p>도착 지점 가까이에서 현재 위치를 확인합니다.</p>${active.finishVerified ? '<p><strong>상태: 완료</strong></p>' : `<div class="verification-actions"><button class="btn btn-primary" data-action="request-location" data-target="finish" ${active.startVerified && active.photoVerified ? '' : 'disabled'}>도착 위치 확인하기</button>${test ? '<button class="btn btn-secondary" data-action="test-location" data-target="finish">개발용 도착 인증</button>' : ''}</div>`}</div></article>
    </div></section>
    ${test ? '<section class="section info-block"><h3>개발용 빠른 인증</h3><button class="btn btn-secondary" data-action="test-complete-all">모든 인증 테스트 완료</button></section>' : ''}
    <div class="section button-row"><button class="btn btn-danger" data-action="stop-course">코스 중단</button><button class="btn btn-primary" data-action="complete-course" ${complete ? '' : 'disabled'}>완주하기</button></div>
    ${complete ? '<p class="status-box"><strong>완주할 준비가 됐어요.</strong><br>완주 버튼을 눌러 기록을 저장하세요.</p>' : '<p class="help">출발 위치, 사진, 도착 위치 인증을 모두 완료해야 완주할 수 있습니다.</p>'}
  </div>`;
}
