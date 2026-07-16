import { getLastRecord } from '../services/activity.js';
import { escapeHTML, formatDate, formatDuration } from '../utils.js';
import { icon } from '../components/icons.js';

export function renderCompletion() {
  const record = getLastRecord();
  if (!record) return '<div class="page"><div class="empty-state"><h1>표시할 완주 기록이 없어요</h1><p>코스를 완주하면 결과를 확인할 수 있습니다.</p><button class="btn btn-primary" data-action="navigate" data-page="courses">코스 찾기</button></div></div>';
  return `<div class="page detail-content"><section class="result-banner"><div class="celebrate" aria-hidden="true">🎉</div><span class="result-badge">완주 인증 완료</span><h1>혼디길 한 걸음 완성!</h1><p class="lead">${escapeHTML(record.courseName)}에서 나만의 제주 한 걸음을 남겼습니다.</p></section>
    <section class="section info-block" aria-labelledby="result-summary"><h2 id="result-summary">완주 기록</h2><dl class="meta-list"><div class="meta-item"><dt>코스</dt><dd>${escapeHTML(record.courseName)}</dd></div><div class="meta-item"><dt>이동 거리</dt><dd>${Number(record.distance).toFixed(1)}km</dd></div><div class="meta-item"><dt>소요 시간</dt><dd>${formatDuration(record.durationMs)}</dd></div><div class="meta-item"><dt>완주 날짜</dt><dd>${formatDate(record.completedAt)}</dd></div></dl><ul class="check-list"><li><span>출발 위치</span><strong>인증 완료</strong></li><li><span>사진</span><strong>인증 완료</strong></li><li><span>도착 위치</span><strong>인증 완료</strong></li></ul></section>
    <div class="section button-row"><button class="btn btn-primary" data-action="view-restaurants" data-course-id="${record.courseId}">주변 맛집 보기</button><button class="btn btn-secondary" data-action="share-record" data-record-id="${record.id}">${icon('share',20)} 완주 기록 공유</button><button class="btn btn-secondary" data-action="navigate" data-page="room">나의 제주방 보기</button></div>
  </div>`;
}
