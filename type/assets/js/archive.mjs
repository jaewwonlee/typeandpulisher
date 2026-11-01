import { TABS, ARCHIVE_HEADERS, archiveFromRows } from './site-data.mjs?v=3';
import { initMenu, watchTab, seedFrom, el } from './site.mjs?v=2';

const table = document.querySelector('.archive-table');
const thumb = document.querySelector('.list-thumb img');
let items = [], open = null, hovered = null;

// 데스크톱 왼쪽 위 칸: 마우스를 올린(또는 키보드로 고른) 항목의 썸네일만 보여주고, 평소에는 비워둔다.
// 썸네일 img는 archive/index.html에 referrerpolicy="no-referrer"로 들어 있다(구글 드라이브 이미지).
function showThumb(item) {
  const src = item?.thumb || '';
  thumb.hidden = !src;
  if (src && thumb.getAttribute('src') !== src) { thumb.src = src; thumb.alt = item.ko || item.en; }
}

function panel(item, id) {
  const box = el('div', 'archive-row__panel');
  box.id = id;
  if (item.images.length) {
    const images = el('div', 'archive-row__images');
    for (const src of item.images) {
      const img = el('img');
      img.referrerPolicy = 'no-referrer'; img.src = src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      images.append(img);
    }
    box.append(images);
  }
  if (item.descKo || item.descEn) {
    const text = el('div', 'archive-row__text');
    if (item.descKo) text.append(Object.assign(el('p', '', item.descKo), { lang: 'ko' }));
    if (item.descEn) text.append(Object.assign(el('p', '', item.descEn), { lang: 'en' }));
    box.append(text);
  }
  return box;
}

function render(rows) {
  items = archiveFromRows(rows);
  const head = el('div', 'archive-head');
  head.append(el('span', '', 'No.'), el('span', '', 'TITLE'), el('span', 'archive-head__en'), el('span', 'archive-row__category', 'CATEGORY'));
  const list = items.map((item, i) => {
    const key = item.no || String(i + 1);
    const row = el('div', 'archive-row');
    const button = el('button', 'archive-row__button');
    button.type = 'button';
    button.append(el('span', '', `[${key}]`), el('span', 'archive-row__ko', item.ko || item.en), el('span', 'archive-row__en', item.en), el('span', 'archive-row__category', item.category));
    row.append(button);
    const hasPanel = item.images.length || item.descKo || item.descEn;
    if (hasPanel) {
      const id = `archive-${i}`;
      button.setAttribute('aria-controls', id);
      // 시트가 갱신돼도 보고 있던 항목은 펼친 채로 둔다.
      const expanded = open === key;
      button.setAttribute('aria-expanded', String(expanded));
      if (expanded) row.append(panel(item, id));
    } else button.disabled = true;
    button.addEventListener('click', () => {
      open = open === key ? null : key;
      render(rows);
      if (open) table.querySelector('[aria-expanded="true"]')?.focus();
    });
    const enter = () => { hovered = key; showThumb(item); };
    const leave = () => { if (hovered === key) { hovered = null; showThumb(null); } };
    button.addEventListener('pointerenter', enter);
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', enter);
    button.addEventListener('blur', leave);
    return row;
  });
  if (!list.length) list.push(el('p', 'archive-empty', '준비 중이에요.'));
  table.replaceChildren(head, ...list);
  // 클릭으로 다시 그려져도 마우스가 올라가 있던 항목의 썸네일은 유지한다.
  showThumb(items.find((item, i) => (item.no || String(i + 1)) === hovered));
}

initMenu();
watchTab({ name: 'archive', gid: TABS.archive, headers: ARCHIVE_HEADERS, seed: seedFrom('archive-seed'), render });
