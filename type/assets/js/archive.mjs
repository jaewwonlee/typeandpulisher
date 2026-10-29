import { TABS, ARCHIVE_HEADERS, archiveFromRows } from './site-data.mjs?v=1';
import { initMenu, watchTab, seedFrom, el } from './site.mjs?v=1';

const table = document.querySelector('.archive-table');
const thumb = document.querySelector('.list-thumb img');
let items = [], open = null;

// 데스크톱 왼쪽 위 칸: 마우스를 올리거나 펼친 항목의 썸네일을 보여준다.
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
      img.src = src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
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
    button.addEventListener('pointerenter', () => showThumb(item));
    button.addEventListener('focus', () => showThumb(item));
    return row;
  });
  if (!list.length) list.push(el('p', 'archive-empty', '준비 중이에요.'));
  table.replaceChildren(head, ...list);
  showThumb(items.find((item, i) => (item.no || String(i + 1)) === open) || items.find(item => item.thumb));
}

initMenu();
watchTab({ gid: TABS.archive, headers: ARCHIVE_HEADERS, seed: seedFrom('archive-seed'), render });
