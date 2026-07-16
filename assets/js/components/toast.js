import { state } from '../state.js';

export function showToast(message) {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = String(message || '');
  element.hidden = false;
  element.classList.add('show');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    element.classList.remove('show');
    window.setTimeout(() => { element.hidden = true; }, 180);
  }, 3000);
}

export function initToast() {
  window.addEventListener('hondigil:toast', event => showToast(event.detail?.message));
}
