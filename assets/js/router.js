import { courseById } from './data/courses.js';
import { state } from './state.js';
import { getUser } from './storage.js';
import { buildShell } from './components/navigation.js';
import { destroyMap, initCourseMap } from './services/map.js';
import { startElapsedTimer, stopElapsedTimer } from './services/activity.js';
import { renderOnboarding } from './pages/onboarding.js';
import { renderHome } from './pages/home.js';
import { renderCourses } from './pages/courses.js';
import { renderCourseDetail } from './pages/course-detail.js';
import { renderActivity } from './pages/activity.js';
import { renderCompletion } from './pages/completion.js';
import { renderJejuRoom } from './pages/jejuroom.js';
import { renderRecords } from './pages/records.js';
import { renderRestaurants } from './pages/restaurants.js';
import { renderSettings } from './pages/settings.js';
import { renderAdmin } from './pages/admin.js';

const aliases = { progress:'activity', result:'completion', room:'jejuroom', more:'settings' };
const reverseAliases = { activity:'progress', completion:'result', jejuroom:'room', settings:'more' };

export function parseRoute(hash = location.hash) {
  const parts = String(hash || '#home').replace(/^#\/?/, '').split('/').filter(Boolean);
  const raw = parts[0] || 'home';
  return { page:aliases[raw] || raw, id:decodeURIComponent(parts[1] || '') };
}

export function navigate(page, options = {}) {
  const canonical = aliases[page] || page;
  let hash = `#${canonical}`;
  if (canonical === 'course') hash += `/${encodeURIComponent(options.id || state.selectedCourseId)}`;
  if (options.id && canonical !== 'course') hash += `/${encodeURIComponent(options.id)}`;
  if (options.replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) location.hash = hash;
  else render();
}

export function cleanupTransientUI() {
  destroyMap();
  stopElapsedTimer();
}

export function render() {
  cleanupTransientUI();
  const app = document.getElementById('app');
  if (!app) return;
  if (!getUser()) {
    app.innerHTML = renderOnboarding();
    document.title = '혼디길 시작하기';
    return;
  }
  const route = parseRoute();
  state.page = route.page;
  state.routeId = route.id;
  if (route.page === 'course' && route.id && courseById(route.id)) state.selectedCourseId = route.id;
  const pages = {
    home:renderHome,
    courses:renderCourses,
    course:renderCourseDetail,
    activity:renderActivity,
    completion:renderCompletion,
    jejuroom:renderJejuRoom,
    records:renderRecords,
    restaurants:renderRestaurants,
    settings:renderSettings,
    admin:renderAdmin
  };
  const renderer = pages[route.page];
  const content = renderer ? renderer() : renderNotFound();
  app.innerHTML = buildShell(content, route.page, true);
  document.title = `${pageTitle(route.page)} | 혼디길`;
  window.scrollTo({ top:0, behavior:'auto' });
  window.setTimeout(() => {
    document.getElementById('main-content')?.focus({ preventScroll:true });
    if (route.page === 'course') initCourseMap(courseById(state.selectedCourseId));
    if (route.page === 'activity') startElapsedTimer();
  }, 0);
}

function renderNotFound() {
  return '<section class="empty-state"><div class="empty-icon">🧭</div><h1>길을 다시 찾고 있어요</h1><p>요청한 화면을 찾지 못했어요.</p><button class="btn btn-primary" data-action="navigate" data-page="home">홈으로 가기</button></section>';
}

function pageTitle(page) {
  return ({home:'홈',courses:'코스',course:'코스 상세',activity:'활동',completion:'완주',jejuroom:'나의 제주방',records:'완주 기록',restaurants:'맛집',settings:'설정',admin:'관리자'})[page] || '페이지를 찾을 수 없음';
}
