import { getRecords } from '../storage.js';
import { renderRecordItem } from './jejuroom.js';

export function renderRecords() {
  const records = getRecords();
  const distance = records.reduce((sum, item) => sum + Number(item.distance || 0), 0);
  return `<div class="page"><header class="page-header"><p class="eyebrow">나의 발자국</p><h1>완주 기록</h1><p class="lead">제주에서 걸은 길이 한눈에 쌓입니다.</p></header><section class="stat-grid"><div class="stat-card"><span>완주 횟수</span><strong>${records.length}회</strong></div><div class="stat-card"><span>누적 거리</span><strong>${distance.toFixed(1)}km</strong></div></section><section class="section">${records.length ? `<div class="record-list">${records.map(renderRecordItem).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">📝</div><h2>기록장이 비어 있어요</h2><p>코스를 완주하면 자동으로 저장돼요.</p><button class="btn btn-primary" data-action="navigate" data-page="courses">코스 고르기</button></div>'}</section></div>`;
}
