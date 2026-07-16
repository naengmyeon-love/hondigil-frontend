import { escapeHTML, formatCourseDuration } from '../utils.js';

export function renderCourseCard(course) {
  return `<article class="card course-card">
    <div class="image-wrap"><img src="${course.image}" alt="${escapeHTML(course.imageAlt)}" loading="lazy" referrerpolicy="no-referrer"><span class="image-label">${course.typeLabel} 코스</span></div>
    <div class="card-body"><p class="eyebrow">${escapeHTML(course.region)}</p><h3>${escapeHTML(course.name)}</h3>
      <div class="chips" aria-label="코스 요약"><span class="chip primary">${course.distance.toFixed(1)}km</span><span class="chip">${formatCourseDuration(course.durationMin)}</span><span class="chip">${escapeHTML(course.difficulty)}</span></div>
      <p class="course-description">${escapeHTML(course.description)}</p>
      <button type="button" class="btn btn-secondary btn-block" data-action="view-course" data-course-id="${course.id}">상세보기</button>
    </div>
  </article>`;
}
