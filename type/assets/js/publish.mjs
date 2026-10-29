import { TABS, PUBLISH_HEADERS } from './site-data.mjs?v=1';
import { initMenu, watchTab } from './site.mjs?v=1';

// 출간물 디자인이 정해지기 전까지는 시트의 제목만 반영하고 본문은 '출간 예정'으로 둔다.
const side = document.querySelector('.list-side .page-title');
const mobile = document.querySelector('.list-main > .page-title');
const fallback = mobile.textContent;

function render(rows) {
  const title = rows.find(r => r['제목'])?.['제목'] || fallback;
  mobile.textContent = title;
  side.firstChild.textContent = title;
}

initMenu();
watchTab({ name: 'publish', gid: TABS.publish, headers: PUBLISH_HEADERS, seed: [], render });
