import { courseById } from '../data/courses.js';
import { getPreferences, getRecords, getUser } from '../storage.js';
import { escapeHTML, formatDate, formatDuration, maskAnonymousId } from '../utils.js';
import { getRoomGrowth } from '../services/growth.js';

export function renderJejuRoom() {
  const user = getUser();
  const records = getRecords();
  const totalDistance = records.reduce((sum, record) => sum + Number(record.distance || 0), 0);
  const growth = getRoomGrowth(records, totalDistance);
  const prefs = getPreferences();
  return `<div class="page"><header class="profile-card"><p class="eyebrow">나의 제주방</p><h1>${escapeHTML(user.nickname)}님의 제주</h1><p class="profile-id">익명 사용자 ID ${escapeHTML(maskAnonymousId(user.id))}</p></header>
    <section class="jeju-room" data-background="${escapeHTML(prefs.background)}" aria-label="완주 기록에 따라 자라는 나의 제주방"><span class="room-label">Lv.${growth.level} · ${escapeHTML(prefs.background)}</span><span class="room-sun" aria-hidden="true"></span><span class="room-character" role="img" aria-label="나의 여행자">${growth.traveler}</span><span class="room-dol" role="img" aria-label="${growth.dolLabel}">${growth.dol}</span><span class="room-tree" role="img" aria-label="${growth.treeLabel}">${growth.tree}</span><div class="room-stickers" aria-label="최근 완주 스티커">${records.length ? records.slice(0,6).map(record => `<span class="room-sticker" role="img" aria-label="${escapeHTML(record.courseName)} 완주">${courseById(record.courseId)?.type === 'run' ? '👟' : '🥾'}</span>`).join('') : '<span class="room-sticker" aria-label="첫 완주를 기다려요">＋</span>'}</div></section>
    <section class="section stat-grid" aria-label="완주 통계"><div class="stat-card"><span>완료한 코스</span><strong>${records.length}개</strong></div><div class="stat-card"><span>누적 거리</span><strong>${totalDistance.toFixed(1)}km</strong></div><div class="stat-card"><span>성장 레벨</span><strong>Lv.${growth.level}</strong></div><div class="stat-card"><span>다음 성장</span><strong>${Math.max(0, 10 - (totalDistance % 10)).toFixed(1)}km</strong></div></section>
    <section class="section" aria-labelledby="room-records"><div class="section-heading"><div><p class="eyebrow">차곡차곡 쌓인 길</p><h2 id="room-records">최근 완주 기록</h2></div><button class="btn btn-text" data-action="navigate" data-page="records">전체 보기</button></div>${records.length ? `<div class="record-list">${records.slice(0,3).map(renderRecordItem).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">🌱</div><h3>아직 저장된 완주 기록이 없어요</h3><p>코스를 완주하면 제주방이 자라기 시작합니다.</p><button class="btn btn-primary" data-action="navigate" data-page="courses">첫 코스 찾기</button></div>'}</section>
    <section class="section button-row"><button class="btn btn-secondary" data-action="navigate" data-page="records">완주 기록 전체 보기</button><button class="btn btn-secondary" data-action="navigate" data-page="settings">제주방 설정</button></section>
  </div>`;
}

export function renderRecordItem(record) {
  return `<article class="record-item"><h3>${escapeHTML(record.courseName)}</h3><p>${formatDate(record.completedAt)} · ${Number(record.distance).toFixed(1)}km · ${formatDuration(record.durationMs)}</p><button class="btn btn-text" data-action="share-record" data-record-id="${record.id}">공유</button></article>`;
}
