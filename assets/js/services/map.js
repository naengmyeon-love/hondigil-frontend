import { state } from '../state.js';

export function destroyMap() {
  if (!state.map) return;
  try { state.map.remove(); } catch (error) { /* 이미 제거된 지도는 무시합니다. */ }
  state.map = null;
}

export function initCourseMap(course) {
  destroyMap();
  const element = document.getElementById('course-map');
  if (!element) return;
  if (!window.L) {
    element.innerHTML = '<div class="map-fallback"><div><strong>지도를 불러오지 못했어요.</strong><p>인터넷 연결을 확인해 주세요. 코스 정보와 시작 기능은 그대로 사용할 수 있습니다.</p></div></div>';
    return;
  }
  try {
    state.map = window.L.map(element, { scrollWheelZoom:false, tap:true });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> 기여자' }).addTo(state.map);
    const path = window.L.polyline(course.route, { color:'#e85d24', weight:6, opacity:.95 }).addTo(state.map);
    window.L.marker(course.start).addTo(state.map).bindTooltip(`출발 · ${course.startName}`, { permanent:true, direction:'top' });
    window.L.marker(course.end).addTo(state.map).bindTooltip(`도착 · ${course.endName}`, { permanent:true, direction:'top' });
    state.map.fitBounds(path.getBounds(), { padding:[32,32] });
    window.setTimeout(() => state.map?.invalidateSize(), 160);
  } catch (error) {
    destroyMap();
    element.innerHTML = '<div class="map-fallback"><div><strong>지도를 표시할 수 없어요.</strong><p>잠시 후 다시 열거나 인터넷 연결을 확인해 주세요.</p></div></div>';
  }
}
