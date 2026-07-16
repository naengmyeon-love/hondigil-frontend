import { restaurantsForCourse } from '../data/restaurants.js';
import { calculateRouteDistanceKm } from '../data/course-routes.js';
import { state } from '../state.js';
import { escapeHTML } from '../utils.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_OPTIONS = Object.freeze({
  subdomains: 'abcd',
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
});
const RESTAURANT_RADIUS_KM = 6;

function markerIcon(type, label) {
  const symbols = { start:'출', end:'도', restaurant:'식' };
  return window.L.divIcon({
    className: 'map-div-icon',
    html: `<span class="map-marker map-marker-${type}" aria-label="${escapeHTML(label)}"><span aria-hidden="true">${symbols[type]}</span></span>`,
    iconSize: type === 'restaurant' ? [34, 42] : [40, 48],
    iconAnchor: type === 'restaurant' ? [17, 39] : [20, 45],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -38]
  });
}

function distanceToRouteKm(restaurant, route) {
  return Math.min(...route.map(point => calculateRouteDistanceKm([point, [restaurant.lat, restaurant.lng]])));
}

function nearbyRestaurants(course) {
  const candidates = restaurantsForCourse(course.id)
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map(item => ({ ...item, routeDistanceKm:distanceToRouteKm(item, course.route) }))
    .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
  const nearby = candidates.filter(item => item.routeDistanceKm <= RESTAURANT_RADIUS_KM);
  return nearby.length ? nearby : candidates.slice(0, 1);
}

function restaurantPopup(restaurant) {
  const query = encodeURIComponent(restaurant.query || restaurant.name);
  return `<article class="map-restaurant-popup">
    <p class="map-popup-eyebrow">${escapeHTML(restaurant.category)}</p>
    <strong>${escapeHTML(restaurant.name)}</strong>
    <p>${escapeHTML(restaurant.menu)} · ${escapeHTML(restaurant.hours)}</p>
    <div class="map-popup-actions"><a href="https://map.naver.com/p/search/${query}" target="_blank" rel="noopener noreferrer">네이버 지도</a><a href="https://map.kakao.com/?q=${query}" target="_blank" rel="noopener noreferrer">카카오맵</a></div>
  </article>`;
}

function addMapControl(map, position, className, content) {
  const control = window.L.control({ position });
  control.onAdd = () => {
    const element = window.L.DomUtil.create('div', className);
    element.innerHTML = content;
    window.L.DomEvent.disableClickPropagation(element);
    window.L.DomEvent.disableScrollPropagation(element);
    return element;
  };
  control.addTo(map);
}

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
    const routeDistance = calculateRouteDistanceKm(course.route);
    const restaurants = nearbyRestaurants(course);
    state.map = window.L.map(element, { scrollWheelZoom:false, tap:true, zoomControl:false });
    window.L.control.zoom({ position:'bottomright' }).addTo(state.map);
    window.L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(state.map);

    window.L.polyline(course.route, { color:'#ffffff', weight:10, opacity:.9, lineCap:'round', lineJoin:'round', interactive:false }).addTo(state.map);
    const path = window.L.polyline(course.route, { color:'#e85d24', weight:6, opacity:1, lineCap:'round', lineJoin:'round' }).addTo(state.map);
    path.bindTooltip(`${escapeHTML(course.name)} · ${routeDistance.toFixed(1)}km`, { sticky:true });

    const startMarker = window.L.marker(course.route[0], { icon:markerIcon('start', `출발 ${course.startName}`), title:`출발 · ${course.startName}` })
      .addTo(state.map).bindTooltip(`출발 · ${escapeHTML(course.startName)}`, { direction:'top' });
    const endMarker = window.L.marker(course.route[course.route.length - 1], { icon:markerIcon('end', `도착 ${course.endName}`), title:`도착 · ${course.endName}` })
      .addTo(state.map).bindTooltip(`도착 · ${escapeHTML(course.endName)}`, { direction:'top' });
    const restaurantMarkers = restaurants.map(restaurant => window.L.marker([restaurant.lat, restaurant.lng], {
      icon:markerIcon('restaurant', `근처 식당 ${restaurant.name}`),
      title:`근처 식당 · ${restaurant.name}`
    }).addTo(state.map).bindTooltip(escapeHTML(restaurant.name), { direction:'top' }).bindPopup(restaurantPopup(restaurant), { maxWidth:280 }));

    addMapControl(state.map, 'topright', 'map-control-card', `<strong>지도 경로 ${routeDistance.toFixed(1)}km</strong><span>표시 거리와 동일 · 근처 식당 ${restaurants.length}곳</span>`);
    addMapControl(state.map, 'bottomleft', 'map-legend', '<span><i class="legend-dot legend-start"></i>출발</span><span><i class="legend-dot legend-end"></i>도착</span><span><i class="legend-dot legend-restaurant"></i>식당</span>');

    const visibleLayers = window.L.featureGroup([path, startMarker, endMarker, ...restaurantMarkers]);
    state.map.fitBounds(visibleLayers.getBounds(), { paddingTopLeft:[28, 76], paddingBottomRight:[28, 40], maxZoom:15 });
    window.setTimeout(() => state.map?.invalidateSize(), 160);
  } catch (error) {
    destroyMap();
    element.innerHTML = '<div class="map-fallback"><div><strong>지도를 표시할 수 없어요.</strong><p>잠시 후 다시 열거나 인터넷 연결을 확인해 주세요.</p></div></div>';
  }
}
