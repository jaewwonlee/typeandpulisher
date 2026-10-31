import { SHEET_ID } from './cms-data.mjs?v=6';
import { rowsFromCSV } from './site-data.mjs?v=2';

// Info / Archive / Publish 공통: 상단 메뉴 닫기와 시트 탭 실시간 반영.

export function initMenu() {
  const menu = document.querySelector('.type-menu');
  document.addEventListener('click', event => { if (menu?.open && !menu.contains(event.target)) menu.open = false; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary').focus(); }
  });
}

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
    fetch(`/dummy/${name}.json`, { cache: 'no-store' }).then(r => r.json()).then(render)
      .catch(error => console.warn('더미 데이터를 불러오지 못했습니다.', error));
    return;
  }
  const cacheKey = `tap-site-cms-v2:${SHEET_ID}:${gid}`;
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
  void refresh();
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  window.addEventListener('online', refresh);
}

export const seedFrom = id => JSON.parse(document.getElementById(id)?.textContent || '[]');
