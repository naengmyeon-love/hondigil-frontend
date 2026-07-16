import { courseById } from '../data/courses.js';
import { getRecords } from '../storage.js';
import { dispatchToast } from '../state.js';
import { formatDuration } from '../utils.js';
import { logEvent } from './events.js';

export async function shareRecord(recordId) {
  const record = getRecords().find(item => item.id === recordId) || getRecords()[0];
  if (!record) return;
  const course = courseById(record.courseId);
  const text = `${record.courseName} ${Number(record.distance).toFixed(1)}km를 ${formatDuration(record.durationMs)} 동안 완주했어요! 나의 제주방도 한 단계 자랐습니다. #혼디길`;
  try {
    if (navigator.share) await navigator.share({ title:'혼디길 완주 기록', text });
    else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); dispatchToast('완주 문구를 복사했어요.'); }
    else copyFallback(text);
    logEvent('record_shared', { courseId:course?.id || record.courseId, recordId:record.id });
  } catch (error) { if (error?.name !== 'AbortError') copyFallback(text); }
}

function copyFallback(text) {
  const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(area); area.select();
  try { document.execCommand('copy'); dispatchToast('완주 문구를 복사했어요.'); }
  catch (error) { dispatchToast('복사가 어려워요. 기록 화면을 캡처해 주세요.'); }
  area.remove();
}
