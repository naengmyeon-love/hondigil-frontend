import { APP_CONFIG } from '../config.js';
import { courseById } from '../data/courses.js';
import { state } from '../state.js';
import { getActiveCourse } from '../storage.js';
import { escapeHTML, formatCourseDuration } from '../utils.js';
import { icon } from '../components/icons.js';

export function renderCourseDetail() {
  const course = courseById(state.selectedCourseId);
  if (!course) return '<div class="empty-state"><h1>코스를 찾을 수 없어요</h1><button class="btn btn-primary" data-action="navigate" data-page="courses">코스 목록</button></div>';
  const active = getActiveCourse();
  const isSame = active?.courseId === course.id;
  return `<div class="page detail-content"><button type="button" class="btn btn-text back-link" data-action="navigate" data-page="courses">${icon('back',20)} 코스 목록으로</button>
    <section class="detail-hero"><div class="image-wrap"><img src="${course.image}" alt="${escapeHTML(course.imageAlt)}" referrerpolicy="no-referrer"><span class="image-label">${course.typeLabel} 코스</span></div></section>
    <header class="detail-title"><p class="eyebrow">${escapeHTML(course.region)}</p><h1>${escapeHTML(course.name)}</h1><p class="lead">${escapeHTML(course.description)}</p></header>
    <dl class="meta-list"><div class="meta-item"><dt>거리</dt><dd>${course.distance.toFixed(1)}km</dd></div><div class="meta-item"><dt>예상 시간</dt><dd>${formatCourseDuration(course.durationMin)}</dd></div><div class="meta-item"><dt>난이도</dt><dd>${escapeHTML(course.difficulty)}</dd></div><div class="meta-item"><dt>유형</dt><dd>${course.typeLabel}</dd></div></dl>
    <section class="info-block" aria-labelledby="route-points-heading"><h3 id="route-points-heading">출발지와 도착지</h3><p><strong>출발</strong> ${escapeHTML(course.startName)}<br><strong>도착</strong> ${escapeHTML(course.endName)}</p></section>
    <section class="section" aria-labelledby="map-heading"><div class="section-heading"><div><p class="eyebrow">미리 보는 경로</p><h2 id="map-heading">코스 지도</h2></div></div><div class="map-shell"><div id="course-map" role="region" aria-label="${escapeHTML(course.name)}의 출발지부터 도착지까지 경로와 근처 식당 지도"></div></div><p class="help">표시 거리는 지도 경로 좌표를 기준으로 계산했습니다. 식당 마커를 누르면 상세 정보와 지도 검색 링크를 볼 수 있어요.</p></section>
    <section class="section info-block"><h3>준비물</h3><ul>${course.supplies.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section><section class="info-block"><h3>안전 안내</h3><p>${escapeHTML(course.caution)}</p></section>
    <div class="sticky-action"><button type="button" class="btn btn-primary btn-block" data-action="${isSame ? 'resume-course' : 'start-course'}" data-course-id="${course.id}">${isSame ? '진행 중인 코스 이어가기' : '이 코스 시작하기'}</button></div>
    ${APP_CONFIG.DEVELOPMENT_MODE ? '<p class="help">개발 모드가 켜져 있습니다.</p>' : ''}
  </div>`;
}
