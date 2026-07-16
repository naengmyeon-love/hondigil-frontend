import { ART_ASSETS, courseById, getCourses } from '../data/courses.js';
import { getActiveCourse, getRecords, getUser } from '../storage.js';
import { escapeHTML, formatDate, formatDuration } from '../utils.js';
import { renderCourseCard } from '../components/course-card.js';

export function renderHome() {
  const user = getUser();
  const active = getActiveCourse();
  const records = getRecords();
  const latest = records[0];
  return `<div class="page">
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-image"><img src="${ART_ASSETS.HERO}" alt="오름과 바다가 보이는 제주 돌담길을 달리는 여행자 일러스트"></div>
      <div class="hero-copy"><p class="eyebrow">${escapeHTML(user.nickname)}님, 혼저 옵서예</p><h1 id="home-title">제주에서 가볍게<br>걷고 달려 보세요</h1><p class="lead">초보자도 부담 없는 길을 골라 완주하고, 가까운 제주 로컬 맛집까지 이어서 만나세요.</p><button type="button" class="btn btn-primary" data-action="navigate" data-page="courses">내게 맞는 코스 찾기</button></div>
    </section>
    ${active ? `<section class="section" aria-labelledby="active-heading"><div class="section-heading"><div><p class="eyebrow">진행 중</p><h2 id="active-heading">걷던 길을 이어가세요</h2></div></div><div class="card summary-card"><div><h3>${escapeHTML(courseById(active.courseId)?.name || '')}</h3><p class="lead">시작 ${formatDate(active.startedAt, true)} · ${active.currentStep === 'complete' ? '완주 확인' : active.currentStep === 'finish' ? '도착 인증' : active.currentStep === 'photo' ? '사진 인증' : '출발 인증'} 단계</p></div><button type="button" class="btn btn-primary" data-action="resume-course">진행 이어가기</button></div></section>` : ''}
    <section class="section" aria-labelledby="recommended-heading"><div class="section-heading"><div><p class="eyebrow">처음이라면 이 길</p><h2 id="recommended-heading">추천 코스</h2></div><button type="button" class="btn btn-text" data-action="navigate" data-page="courses">전체 보기</button></div><div class="card-grid three">${getCourses().slice(0, 3).map(renderCourseCard).join('')}</div></section>
    <section class="section" aria-labelledby="recent-heading"><div class="section-heading"><div><p class="eyebrow">나의 기록</p><h2 id="recent-heading">최근 완주</h2></div></div>${latest ? `<div class="card summary-card"><div><span class="summary-number">${latest.distance.toFixed(1)}km</span><h3>${escapeHTML(latest.courseName)}</h3><p class="lead">${formatDate(latest.completedAt)} · ${formatDuration(latest.durationMs)}</p></div><button type="button" class="btn btn-secondary" data-action="navigate" data-page="room">제주방에서 보기</button></div>` : '<div class="empty-state"><div class="empty-icon" aria-hidden="true">🥾</div><h3>아직 완주 기록이 없어요</h3><p>첫 코스를 골라 제주에서 나만의 한 걸음을 시작해 보세요.</p></div>'}</section>
  </div>`;
}
