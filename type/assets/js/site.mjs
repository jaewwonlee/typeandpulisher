import { SHEET_ID } from './cms-data.mjs?v=7';
import { rowsFromCSV } from './site-data.mjs?v=6';
import { animateMenu, closeMenu } from './menu-drop.mjs?v=2';
import { initCredits } from './credits.mjs?v=5';

// Info / Archive / Publish 공통: 상단 메뉴 닫기와 시트 탭 실시간 반영.

export function initMenu() {
  const menu = document.querySelector('.type-menu');
  animateMenu(menu);
  initCredits();
  document.addEventListener('click', event => { if (menu?.open && !menu.contains(event.target)) closeMenu(menu); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.open) { closeMenu(menu); menu.querySelector('summary').focus(); }
  });
}

// 시트 칸의 글은 CSV로 받아서 셀에 건 하이퍼링크는 사라진다. 그래서 글 안에
// [보일 글자](https://주소) 형식이나 https://로 시작하는 주소를 그대로 쓰면 링크로 만든다(새 탭).
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,!?'"’”])/g;
export function linkify(text) {
  const nodes = [];
  let last = 0;
  for (const m of String(text ?? '').matchAll(LINK)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const a = el('a', '', m[1] || m[3]);
    a.href = m[2] || m[3]; a.target = '_blank'; a.rel = 'noopener';
    nodes.push(a);
    last = m.index + m[0].length;
  }
  if (last < String(text ?? '').length) nodes.push(text.slice(last));
  return nodes;
}

// 구글 드라이브 사진(lh3)은 주소 끝 =w숫자로 크기를 고를 수 있고 -rw를 붙이면 WebP로 온다.
// 원본(=w2400 JPEG)보다 3~4배 가벼워서 보이는 크기에 맞춰 받는다. 다른 주소는 그대로 둔다.
export const sized = (src, width) => String(src || '').replace(/^(https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+)=w\d+$/, `$1=w${width}-rw`);

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// 타입 페이지 cms.js와 같은 방식: 정적 사본 → 마지막 정상 데이터(localStorage) → 시트를 30초마다 재조회.
// 시트에 내용 행이 하나도 없으면 페이지에 넣어둔 정적 사본을 그대로 보여준다.
export function watchTab({ name, gid, headers, headerRow = 0, seed, render }) {
  // 주소 끝에 ?dummy 를 붙이면 시트 대신 /dummy/<name>.json 을 보여준다. 시트와 캐시는 건드리지 않는다.
  if (new URLSearchParams(location.search).has('dummy')) {
    render(seed);
    reveal();
    fetch(`/dummy/${name}.json`, { cache: 'no-store' }).then(r => r.json()).then(render)
      .catch(error => console.warn('더미 데이터를 불러오지 못했습니다.', error));
    return;
  }
  const cacheKey = `tap-site-cms-v3:${SHEET_ID}:${gid}`;
  let current = '', busy = false;
  const show = rows => {
    const next = rows.length ? rows : seed;
    const key = JSON.stringify(next);
    if (key === current) return;
    current = key;
    render(next);
  };
  show(seed);
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    if (saved && typeof saved.csv === 'string') show(rowsFromCSV(saved.csv, headers, headerRow));
  } catch { /* 저장소를 못 써도 페이지는 뜬다. */ }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`CMS HTTP ${response.status}`);
      const csv = await response.text();
      show(rowsFromCSV(csv, headers, headerRow));
      try { localStorage.setItem(cacheKey, JSON.stringify({ csv, savedAt: Date.now() })); } catch { /* 선택 사항 */ }
      document.documentElement.dataset.cmsState = 'live';
    } catch (error) {
      document.documentElement.dataset.cmsState = 'fallback';
      console.warn('CMS 갱신 실패: 마지막 정상 콘텐츠를 유지합니다.', error);
    } finally { clearTimeout(timer); busy = false; }
  }
  // 정적 사본·저장된 내용으로 첫 화면을 그렸고 글꼴까지 준비되면 가림막을 걷는다.
  reveal();
  void refresh();
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  window.addEventListener('online', refresh);
}

export function reveal() {
  (document.fonts?.ready ?? Promise.resolve()).then(() => document.documentElement.classList.remove('is-loading'));
}

// Archive·Publish 데스크톱 왼쪽 카드: 시트 탭의 '페이지 소개 국문/영문' 칸(어느 행이든 처음 채워진 값)을
// 제목 아래에 보여준다. 둘 다 비어 있으면 원래 들어 있던 연락처 안내를 그대로 둔다.
export const INTRO_KO = '페이지 소개 국문', INTRO_EN = '페이지 소개 영문';
let defaultAbout;
export function sideIntro(rows) {
  const about = document.querySelector('.list-side__about');
  if (!about) return;
  defaultAbout ??= [...about.childNodes].map(node => node.cloneNode(true));
  const pick = key => rows.find(r => r[key])?.[key] || '';
  const ko = pick(INTRO_KO), en = pick(INTRO_EN);
  if (!ko && !en) { about.replaceChildren(...defaultAbout.map(node => node.cloneNode(true))); return; }
  const para = (text, className, lang) => { const p = el('p', className); p.lang = lang; p.append(...linkify(text)); return p; };
  about.replaceChildren(...[ko && para(ko, 'list-side__notice', 'ko'), en && para(en, ko ? '' : 'list-side__notice', 'en')].filter(Boolean));
}

export const seedFrom = id => JSON.parse(document.getElementById(id)?.textContent || '[]');
