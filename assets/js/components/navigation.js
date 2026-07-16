import { getUser } from '../storage.js';
import { escapeHTML } from '../utils.js';
import { icon } from './icons.js';

const items = [
  { page:'home', label:'홈', icon:'home' },
  { page:'courses', label:'코스', icon:'courses' },
  { page:'room', label:'나의 제주방', icon:'room' },
  { page:'more', label:'더보기', icon:'more' }
];

function canonical(page) {
  return ({ jejuroom:'room', records:'room', settings:'more', activity:'courses', progress:'courses', completion:'room', result:'room', restaurants:'courses', course:'courses' })[page] || page;
}

export function buildShell(content, activePage, showNavigation = true) {
  const user = getUser();
  const active = canonical(activePage);
  const nav = (className) => items.map(item => `<button type="button" class="${className}" data-action="navigate" data-page="${item.page}" ${active === item.page ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span></button>`).join('');
  return `<header class="site-header"><div class="header-inner">
    <button type="button" class="brand btn-text" data-action="navigate" data-page="home" aria-label="혼디길 홈으로"><span class="brand-mark" aria-hidden="true"></span><span>혼디길</span></button>
    <nav class="desktop-nav" aria-label="주요 메뉴">${nav('nav-btn')}</nav>
    <span class="header-user">${escapeHTML(user?.nickname || '')}님</span>
  </div></header>
  <main id="main-content" class="main" tabindex="-1">${content}</main>
  ${showNavigation ? `<nav class="bottom-nav" aria-label="하단 주요 메뉴">${nav('nav-btn')}</nav>` : ''}`;
}
