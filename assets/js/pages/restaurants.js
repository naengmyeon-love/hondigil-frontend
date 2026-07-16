import { courseById } from '../data/courses.js';
import { restaurantsForCourse } from '../data/restaurants.js';
import { state } from '../state.js';
import { escapeHTML } from '../utils.js';

function mapLinks(restaurant) {
  const query = encodeURIComponent(restaurant.query || restaurant.name);
  return { naver:`https://map.naver.com/p/search/${query}`, kakao:`https://map.kakao.com/link/search/${query}` };
}

export function renderRestaurants() {
  const course = courseById(state.selectedCourseId);
  if (!course) return '<div class="empty-state"><h1>코스를 먼저 선택해 주세요</h1><button class="btn btn-primary" data-action="navigate" data-page="courses">코스 찾기</button></div>';
  const restaurants = restaurantsForCourse(course.id);
  return `<div class="page"><button class="btn btn-text back-link" data-action="navigate" data-page="result">완주 결과로</button><header class="page-header"><p class="eyebrow">${escapeHTML(course.name)} 가까이</p><h1>완주 뒤 든든한 한 끼</h1><p class="lead">완주 지점 주변의 소규모 식당 샘플입니다. 영업시간은 방문 전에 지도에서 다시 확인해 주세요.</p></header>
    <div class="card-grid">${restaurants.map(restaurant => { const links = mapLinks(restaurant); return `<article class="card restaurant-card"><div class="card-body"><div><p class="eyebrow">${escapeHTML(restaurant.category)} · ${escapeHTML(restaurant.distance)}</p><h2 class="card-title">${escapeHTML(restaurant.name)}</h2></div><p class="course-description">${escapeHTML(restaurant.description)}</p><div class="restaurant-reason">✓ 완주 코스 가까이에서 제주다운 한 끼를 즐기기 좋아요.</div><dl class="meta-list"><div class="meta-item"><dt>영업시간</dt><dd>${escapeHTML(restaurant.hours)}</dd></div><div class="meta-item"><dt>대표 메뉴</dt><dd>${escapeHTML(restaurant.menu)}</dd></div></dl><button class="btn btn-text" data-action="restaurant-click" data-restaurant-id="${restaurant.id}">이 맛집 정보 기록하기</button><div class="restaurant-actions"><a class="btn btn-secondary" href="${links.naver}" target="_blank" rel="noopener noreferrer" data-action="directions" data-map="naver" data-restaurant-id="${restaurant.id}">네이버지도</a><a class="btn btn-secondary" href="${links.kakao}" target="_blank" rel="noopener noreferrer" data-action="directions" data-map="kakao" data-restaurant-id="${restaurant.id}">카카오맵</a></div></div></article>`; }).join('')}</div>
    <p class="notice"><span aria-hidden="true">ⓘ</span><span>식당 정보는 MVP 시연용 예시입니다. 실제 방문 전 지도와 매장 안내를 확인해 주세요.</span></p>
  </div>`;
}
