import { getCourses } from '../data/courses.js';
import { state } from '../state.js';
import { renderCourseCard } from '../components/course-card.js';

export function getFilteredCourses() {
  return getCourses().filter(course => {
    const displayedDistance = Number(course.distance.toFixed(1));
    if (state.filters.type !== 'all' && course.type !== state.filters.type) return false;
    if (state.filters.difficulty !== 'all' && course.difficulty !== state.filters.difficulty) return false;
    if (state.filters.distance === 'short' && displayedDistance > 2.5) return false;
    if (state.filters.distance === 'medium' && (displayedDistance <= 2.5 || displayedDistance > 3)) return false;
    if (state.filters.distance === 'long' && displayedDistance <= 3) return false;
    return true;
  });
}

const selected = (value, expected) => value === expected ? 'selected' : '';

export function renderCourses() {
  const courses = getFilteredCourses();
  return `<div class="page"><header class="page-header"><p class="eyebrow">제주 맞춤 코스</p><h1>오늘의 나와 맞는 길</h1><p class="lead">걷기와 러닝, 거리와 난이도를 골라 부담 없는 코스를 확인할 수 있어요.</p></header>
    <section class="filter-panel" aria-labelledby="filter-heading"><h2 id="filter-heading" class="filter-heading">코스 유형</h2><div class="filter-chips">
      <button type="button" class="filter-chip" data-action="filter-type" data-value="all" aria-pressed="${state.filters.type === 'all'}">전체</button>
      <button type="button" class="filter-chip" data-action="filter-type" data-value="walk" aria-pressed="${state.filters.type === 'walk'}">걷기</button>
      <button type="button" class="filter-chip" data-action="filter-type" data-value="run" aria-pressed="${state.filters.type === 'run'}">러닝</button></div>
      <div class="filter-selects"><div class="field"><label for="distance-filter">거리</label><select class="select" id="distance-filter" data-filter="distance"><option value="all" ${selected(state.filters.distance,'all')}>전체 거리</option><option value="short" ${selected(state.filters.distance,'short')}>2.5km 이하</option><option value="medium" ${selected(state.filters.distance,'medium')}>2.5~3km</option><option value="long" ${selected(state.filters.distance,'long')}>3km 초과</option></select></div>
      <div class="field"><label for="difficulty-filter">난이도</label><select class="select" id="difficulty-filter" data-filter="difficulty"><option value="all" ${selected(state.filters.difficulty,'all')}>전체 난이도</option><option value="쉬움" ${selected(state.filters.difficulty,'쉬움')}>쉬움</option><option value="보통" ${selected(state.filters.difficulty,'보통')}>보통</option></select></div></div>
    </section>
    <div class="section-heading"><h2>검색 결과 <span aria-live="polite">${courses.length}개</span></h2></div>
    ${courses.length ? `<div class="card-grid three">${courses.map(renderCourseCard).join('')}</div>` : '<div class="empty-state"><div class="empty-icon" aria-hidden="true">🧭</div><h3>조건에 맞는 코스가 없어요</h3><p>거리나 난이도를 넓혀 다시 찾아보세요.</p><button type="button" class="btn btn-secondary" data-action="reset-filters">필터 초기화</button></div>'}
  </div>`;
}
