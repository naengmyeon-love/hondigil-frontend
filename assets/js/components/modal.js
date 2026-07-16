import { state } from '../state.js';
import { escapeHTML } from '../utils.js';

export function openModal(html, focusSelector = 'button, a, input, select') {
  const root = document.getElementById('modal-root');
  if (!root) return;
  state.returnFocus = document.activeElement;
  root.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${html}</section></div>`;
  document.body.classList.add('modal-open');
  window.setTimeout(() => root.querySelector(focusSelector)?.focus(), 0);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (state.returnFocus?.isConnected) state.returnFocus.focus();
  state.returnFocus = null;
}

export function openConfirm(title, description, confirmLabel, actionName) {
  state.pendingConfirmAction = actionName;
  openModal(`
    <div class="modal-head"><div><p class="eyebrow">확인이 필요해요</p><h2 id="modal-title">${escapeHTML(title)}</h2></div><button type="button" class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div>
    <p>${escapeHTML(description)}</p>
    <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">취소</button><button type="button" class="btn ${actionName === 'delete-all' ? 'btn-danger' : 'btn-primary'}" data-action="confirm-pending">${escapeHTML(confirmLabel)}</button></div>
  `);
}

export function trapModalFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = document.querySelector('.modal');
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
